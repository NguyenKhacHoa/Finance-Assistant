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

    const pockets = await this.prisma.pocket.findMany({ where: { userId } });
    const pocketTotal = pockets.reduce((s, p) => s + Number(p.balance), 0);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const unallocatedBalance = Number(user?.unallocatedBalance || 0);

    const totalBalance = pocketTotal + unallocatedBalance;

    return { income, expense, balance: income - expense, totalBalance, unallocatedBalance };
  }

  // ── GET chart data (income/expense grouped by day) ────────────
  async getChartData(userId: string, days: number = 7) {
    const since = new Date(Date.now() - days * 86_400_000);
    since.setHours(0, 0, 0, 0);

    const txs = await this.prisma.transaction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { amount: true, type: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const dayMap = new Map<string, { income: number; expense: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 86_400_000);
      dayMap.set(d.toISOString().slice(0, 10), { income: 0, expense: 0 });
    }

    for (const tx of txs) {
      const key = tx.createdAt.toISOString().slice(0, 10);
      const entry = dayMap.get(key) ?? { income: 0, expense: 0 };
      if (tx.type === 'INCOME' || tx.type === 'LUONG') entry.income += Number(tx.amount);
      else if (tx.type === 'EXPENSE') entry.expense += Number(tx.amount);
      dayMap.set(key, entry);
    }

    return Array.from(dayMap.entries()).map(([date, vals]) => {
      const d = new Date(date);
      const label = days <= 7
        ? d.toLocaleDateString('vi-VN', { weekday: 'short' })
        : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      return {
        date,
        label,
        income: vals.income,
        expense: vals.expense,
      };
    });
  }

  // ── CREATE transaction ───────────────────────────────────────
  async createTransaction(userId: string, dto: {
    amount: number;
    title: string;
    category: string;
    pocketId: string;
    type: 'EXPENSE' | 'INCOME' | 'LUONG';
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
}
