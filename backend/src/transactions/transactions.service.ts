import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsGateway } from '../alerts/alerts.gateway';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsGateway: AlertsGateway,
  ) {}

  // ── GET all transactions ─────────────────────────────────────
  async getTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { pocket: { select: { name: true, balance: true } } },
    });
  }

  // ── GET monthly stats ────────────────────────────────────────
  async getMonthlyStats(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const txs = await this.prisma.transaction.findMany({
      where: { userId, createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });

    const income = txs
      .filter((t) => t.type === 'INCOME' || t.type === 'LUONG')
      .reduce((s, t) => s + Number(t.amount), 0);

    const expense = txs
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + Number(t.amount), 0);

    // ── Tính tổng số dư hũ thật (không bao gồm "Tiền chưa vào hũ") ──
    const pockets = await this.prisma.pocket.findMany({ where: { userId } });
    const realPockets = pockets.filter((p) => p.name !== 'Tiền chưa vào hũ');
    const totalBalance = realPockets.reduce((s, p) => s + Number(p.balance), 0);

    // ── Tổng tiền đang trong mục tiêu (có thể expose để dashboard dùng) ──
    const activeGoals = await this.prisma.savingsGoal.findMany({
      where: { userId },
      select: { currentAmount: true },
    });
    const totalGoalFunded = activeGoals.reduce((s, g) => s + Number(g.currentAmount), 0);

    // ── unallocatedBalance: tiền lương dư chưa được phân bổ vào hũ nào ──
    // Nguồn: pocket "Tiền chưa vào hũ" (surplus khi % < 100%) + user.unallocatedBalance (chi phí cố định)
    // Tách biệt HOÀN TOÀN khỏi totalBalance (tổng các hũ thật)
    const unallocatedPocket = pockets.find((p) => p.name === 'Tiền chưa vào hũ');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const unallocatedBalance = Math.max(0, Number(unallocatedPocket?.balance || 0) + Number(user?.unallocatedBalance || 0));

    return { income, expense, balance: income - expense, totalBalance, unallocatedBalance, totalGoalFunded };
  }

  // ── GET chart data (income/expense grouped by day) ────────────
  // Timezone: Asia/Ho_Chi_Minh (UTC+7)
  async getChartData(userId: string, days: number = 7) {
    const TZ = 'Asia/Ho_Chi_Minh';
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

    // Helper: convert a UTC Date → "YYYY-MM-DD" in VN timezone
    const toVnDateKey = (utcDate: Date): string => {
      const vnMs = utcDate.getTime() + VN_OFFSET_MS;
      return new Date(vnMs).toISOString().slice(0, 10);
    };

    // "Today" midnight in VN time expressed as UTC midnight-equivalent
    const nowVnMs = Date.now() + VN_OFFSET_MS;
    const todayVnMidnightMs = nowVnMs - (nowVnMs % 86_400_000); // floor to day

    // Start of range = today (VN) - (days-1) days → includes today as the LAST entry
    const startVnMidnightMs = todayVnMidnightMs - (days - 1) * 86_400_000;

    // Equivalent UTC Date for DB query  (midnight VN = 17:00 previous day UTC)
    const sinceUtc = new Date(startVnMidnightMs - VN_OFFSET_MS);

    const txs = await this.prisma.transaction.findMany({
      where: { userId, createdAt: { gte: sinceUtc } },
      select: { amount: true, type: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Pre-fill every day in range with zeros (Mon-first week ordering preserved by chronological sort)
    const dayMap = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < days; i++) {
      const vnDayMs = startVnMidnightMs + i * 86_400_000;
      const key = new Date(vnDayMs).toISOString().slice(0, 10); // still "YYYY-MM-DD"
      dayMap.set(key, { income: 0, expense: 0 });
    }

    // Map each transaction to its VN local date key
    for (const tx of txs) {
      const key = toVnDateKey(tx.createdAt);
      const entry = dayMap.get(key) ?? { income: 0, expense: 0 };
      if (tx.type === 'INCOME' || tx.type === 'LUONG') entry.income += Number(tx.amount);
      else if (tx.type === 'EXPENSE') entry.expense += Number(tx.amount);
      dayMap.set(key, entry);
    }

    return Array.from(dayMap.entries()).map(([date, vals]) => {
      // Build label using VN locale + explicit timezone
      const d = new Date(date + 'T00:00:00+07:00');
      const isWeek = days <= 7;
      const label = isWeek
        ? d.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: TZ })
        : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: TZ });
      return { date, label, income: vals.income, expense: vals.expense };
    });
  }

  // ── CREATE transaction ───────────────────────────────────────
  async createTransaction(userId: string, dto: {
    amount: number;
    title: string;
    category: string;
    pocketId: string;
    type: 'EXPENSE' | 'INCOME' | 'LUONG';
    source?: 'CASH' | 'BANK';
    metadata?: any;
  }) {
    if (!dto.amount || dto.amount <= 0) throw new BadRequestException('Số tiền phải lớn hơn 0.');

    // ── Lấy thông tin hũ ĐƯỢC CHỌN (không phải hũ Thiết Yếu) ──
    const pocket = await this.prisma.pocket.findUnique({ where: { id: dto.pocketId } });
    if (!pocket || pocket.userId !== userId) throw new BadRequestException('Không tìm thấy hũ tài chính.');

    const amountDecimal = new Prisma.Decimal(Math.round(dto.amount));

    const txData = {
      userId,
      pocketId: dto.pocketId,
      amount: amountDecimal,
      type: dto.type as any,
      source: (dto.source || 'CASH') as any,
      title: dto.title,
      category: dto.category as any,
      metadata: dto.metadata,
    };

    // ── INCOME / LUONG: Cộng tiền vào hũ, không cần kiểm tra Survival ──
    if (dto.type === 'INCOME' || dto.type === 'LUONG') {
      const [, transaction] = await this.prisma.$transaction([
        this.prisma.pocket.update({ where: { id: dto.pocketId }, data: { balance: { increment: amountDecimal } } }),
        this.prisma.transaction.create({ data: txData }),
      ]);
      return transaction;
    }

    // ── EXPENSE: Kiểm tra Survival Mode dựa trên TỔNG TÀI SẢN hệ thống ──
    const survivalConfig = await this.prisma.survivalConfig.findUnique({ where: { userId } });
    const threshold = survivalConfig?.triggerThreshold ? Number(survivalConfig.triggerThreshold) : 2000000;
    
    // Survival chỉ block khi TỔNG tất cả hũ thiết yếu < threshold  
    // KHÔNG block dựa trên hũ người dùng đang chọn
    const isManualSurvival = survivalConfig?.isActive === true;
    
    if (isManualSurvival && !pocket.isEssential) {
      // Admin đã bật Survival Mode thủ công → block chi tiêu hũ non-essential
      const essentialPockets = await this.prisma.pocket.findMany({ where: { userId, isEssential: true } });
      const totalEssential = essentialPockets.reduce((s, p) => s + Number(p.balance), 0);
      const blockReason = `Chế độ Sinh Tồn đang HOẠT ĐỘNG. ` +
        `Hũ Thiết Yếu: ${totalEssential.toLocaleString()} VNĐ < ngưỡng ${threshold.toLocaleString()} VNĐ. ` +
        `Giao dịch "${dto.title}" bị chặn để bảo vệ ngân sách thiết yếu.`;
      this.alertsGateway.sendBlockAlert(userId, { title: 'Giao dịch bị chặn – Survival Mode', reason: blockReason, attemptedAmount: dto.amount });
      throw new ForbiddenException(blockReason);
    }

    // ── Kiểm tra số dư của CHÍNH HŨ ĐƯỢC CHỌN ──
    if (Number(pocket.balance) < dto.amount) {
      throw new BadRequestException(
        `Hũ "${pocket.name}" không đủ số dư. Hiện có: ${Number(pocket.balance).toLocaleString()} VNĐ, ` +
        `cần: ${dto.amount.toLocaleString()} VNĐ.`
      );
    }

    // ── Thực hiện giao dịch chi tiêu ──
    const [updatedPocket, transaction] = await this.prisma.$transaction([
      this.prisma.pocket.update({ where: { id: dto.pocketId }, data: { balance: { decrement: amountDecimal } } }),
      this.prisma.transaction.create({ data: txData }),
    ]);

    // Auto-activate Survival Mode nếu pocket Thiết Yếu xuống thấp sau giao dịch
    if (pocket.isEssential && (Number(updatedPocket.balance)) < threshold) {
      this.alertsGateway.sendSurvivalAlert(userId, {
        title: 'BÁO ĐỘNG: Hũ Thiết Yếu cạn tiền!',
        message: `Hũ "${pocket.name}" còn ${Number(updatedPocket.balance).toLocaleString()} VNĐ — dưới ngưỡng ${threshold.toLocaleString()} VNĐ. Hãy cân nhắc kích hoạt Chế độ Sinh Tồn.`,
      });
    }

    return transaction;
  }

  // ── EDIT transaction ─────────────────────────────────────────
  async editTransaction(userId: string, transactionId: string, dto: {
    title?: string;
    amount?: number;
    category?: string;
  }) {
    const existing = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!existing || existing.userId !== userId) {
      throw new BadRequestException('Không tìm thấy giao dịch hoặc không có quyền truy cập.');
    }

    const oldAmount = Number(existing.amount);
    const newAmount = dto.amount !== undefined ? Math.round(dto.amount) : oldAmount;
    const delta = newAmount - oldAmount; // dương: tăng tiền, âm: giảm tiền

    return this.prisma.$transaction(async (tx) => {
      // Rollback số dư hũ tương ứng nếu amount thay đổi
      if (delta !== 0 && existing.pocketId) {
        const pocket = await (tx as any).pocket.findUnique({ where: { id: existing.pocketId } });
        if (pocket && pocket.userId === userId) {
          if (existing.type === 'INCOME' || existing.type === 'LUONG') {
            // INCOME: cũ cộng vào hũ → tăng thêm delta
            await (tx as any).pocket.update({
              where: { id: existing.pocketId },
              data: { balance: { increment: delta } },
            });
          } else if (existing.type === 'EXPENSE') {
            // EXPENSE: cũ trừ hũ → trừ thêm delta (delta âm = refund)
            const newBalance = Number(pocket.balance) - delta;
            if (newBalance < 0) throw new BadRequestException('Số dư hũ không đủ sau khi chỉnh sửa.');
            await (tx as any).pocket.update({
              where: { id: existing.pocketId },
              data: { balance: { decrement: delta } },
            });
          }
        }
      }

      return (tx as any).transaction.update({
        where: { id: transactionId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.amount !== undefined && { amount: newAmount }),
          ...(dto.category !== undefined && { category: dto.category as any }),
        },
      });
    });
  }

  // ── DELETE transaction ───────────────────────────────────────
  async deleteTransaction(userId: string, transactionId: string) {
    const existing = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!existing || existing.userId !== userId) {
      throw new BadRequestException('Không tìm thấy giao dịch hoặc không có quyền truy cập.');
    }

    const amount = Number(existing.amount);

    await this.prisma.$transaction(async (tx) => {
      // Rollback số dư hũ
      if (existing.pocketId && amount > 0) {
        const pocket = await (tx as any).pocket.findUnique({ where: { id: existing.pocketId } });
        if (pocket && pocket.userId === userId) {
          if (existing.type === 'INCOME' || existing.type === 'LUONG') {
            await (tx as any).pocket.update({
              where: { id: existing.pocketId },
              data: { balance: { decrement: amount } },
            });
          } else if (existing.type === 'EXPENSE') {
            await (tx as any).pocket.update({
              where: { id: existing.pocketId },
              data: { balance: { increment: amount } },
            });
          }
        }
      }

      await (tx as any).transaction.delete({ where: { id: transactionId } });
    });

    return { success: true, deletedId: transactionId };
  }
}
