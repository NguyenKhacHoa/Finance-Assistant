import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PocketsService {
  constructor(private prisma: PrismaService) {}

  // Lấy danh sách 6 hũ của User
  async getUserPockets(userId: string) {
    return this.prisma.pocket.findMany({
      where: { userId },
      orderBy: { percentage: 'desc' },
    });
  }

  // Tạo hũ đơn lẻ
  async createPocket(userId: string, data: { name: string; percentage: number; balance: number; isEssential?: boolean }) {
    await this.prisma.pocket.create({
      data: {
        userId,
        name: data.name,
        percentage: new Prisma.Decimal(data.percentage),
        balance: new Prisma.Decimal(data.balance || 0),
        isEssential: data.isEssential || false,
      }
    });
    return this.getUserPockets(userId);
  }

  // Cập nhật hũ
  async updatePocket(userId: string, pocketId: string, data: { name: string; percentage: number; isEssential?: boolean }) {
    await this.prisma.pocket.update({
      where: { id: pocketId, userId },
      data: {
        name: data.name,
        percentage: new Prisma.Decimal(data.percentage),
        isEssential: data.isEssential,
      }
    });
    return this.getUserPockets(userId);
  }

  // Xóa hũ — hoàn tiền về unallocated trước khi xóa (Prisma Transaction)
  async deletePocket(userId: string, pocketId: string) {
    const pocket = await this.prisma.pocket.findUnique({ where: { id: pocketId } });
    if (!pocket || pocket.userId !== userId) throw new BadRequestException('Hũ không hợp lệ');

    const pocketBalance = Number(pocket.balance);

    await this.prisma.$transaction(async (tx) => {
      // 1. Hoàn toàn bộ balance của hũ vào unallocatedBalance của User
      //    Phải hoàn tiền TRƯỚC khi xóa để tránh vi phạm foreign key SetNull
      if (pocketBalance > 0) {
        // Bước 1a: Cộng balance vào unallocatedBalance của User
        await tx.user.update({
          where: { id: userId },
          data: { unallocatedBalance: { increment: pocketBalance } },
        });

        // Bước 1b: Tạo bản ghi lịch sử giao dịch (type: SYSTEM)
        await (tx as any).transaction.create({
          data: {
            userId,
            pocketId: pocket.id,
            amount: pocketBalance,
            type: 'SYSTEM',
            source: 'SYSTEM',
            title: `Hoàn tiền xóa hũ ${pocket.name}`,
            category: 'Other',
          },
        });
      }

      // 2. Xóa hũ sau khi đã hoàn tiền và tạo lịch sử thành công
      await tx.pocket.delete({ where: { id: pocketId } });
    });

    return this.getUserPockets(userId);
  }

  // Khởi tạo 6 hũ mặc định nếu chưa có
  async initializeDefaultPockets(userId: string) {
    const defaultPockets = [
      { name: 'Thiết yếu (NEC)', percentage: 55.0, isEssential: true, color: '#f87171' },
      { name: 'Tự do tài chính (FFA)', percentage: 10.0, isEssential: false, color: '#60a5fa' },
      { name: 'Giáo dục (EDU)', percentage: 10.0, isEssential: false, color: '#facc15' },
      { name: 'Khấu hao (LTS)', percentage: 10.0, isEssential: false, color: '#c084fc' },
      { name: 'Hưởng thụ (PLY)', percentage: 10.0, isEssential: false, color: '#34d399' },
      { name: 'Từ thiện (GIV)', percentage: 5.0, isEssential: false, color: '#f472b6' },
    ];

    const pocketRecords = defaultPockets.map((p) => ({
      userId,
      name: p.name,
      percentage: new Prisma.Decimal(p.percentage),
      balance: new Prisma.Decimal(0),
      isEssential: p.isEssential,
    }));

    await this.prisma.pocket.createMany({
      data: pocketRecords,
      skipDuplicates: true,
    });

    return this.getUserPockets(userId);
  }

  // Logic phân bổ thu nhập (Lương) vào 6 hũ — Largest Remainder Method
  async distributeIncome(userId: string, totalAmount: number) {
    if (totalAmount <= 0) {
      throw new BadRequestException('Số tiền thu nhập phải lớn hơn 0');
    }

    // Làm tròn về số nguyên (loại bỏ xu lẻ phát sinh từ client)
    const safeTotal = Math.round(totalAmount);

    let pockets = await this.getUserPockets(userId);

    // Nếu user chưa có hũ nào, tự động khởi tạo theo quy tắc chuẩn
    if (pockets.length === 0) {
      pockets = await this.initializeDefaultPockets(userId);
    }

    // Kiểm tra tổng % có bằng 100% không
    const totalPercentage = pockets.reduce((acc, pocket) => acc + Number(pocket.percentage), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new BadRequestException('Tổng tỷ lệ các hũ phải bằng 100%');
    }

    // ── Largest Remainder Method ──────────────────────────────────────────
    // Đảm bảo SUM(allocations) === safeTotal, không thừa thiếu 1 đồng
    // normFactor = 1 vì đã validate tổng = 100%, nhưng giữ để an toàn
    const normFactor = totalPercentage > 0 ? 100 / totalPercentage : 1;

    const working = pockets.map((pocket) => {
      const exactAmount = safeTotal * ((Number(pocket.percentage) * normFactor) / 100);
      return {
        id: pocket.id,
        exactAmount,
        allocatedAmount: Math.floor(exactAmount),
        remainder: exactAmount - Math.floor(exactAmount),
      };
    });

    const totalFloored = working.reduce((s, w) => s + w.allocatedAmount, 0);
    const leftover = safeTotal - totalFloored;

    // Cộng +1 cho các hũ có phần thập phân lớn nhất
    const sorted = [...working].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < leftover; i++) {
      sorted[i % sorted.length].allocatedAmount += 1;
    }

    // Assertion — không bao giờ được sai
    const finalCheck = sorted.reduce((s, w) => s + w.allocatedAmount, 0);
    if (finalCheck !== safeTotal) {
      throw new Error(`[FATAL] Lỗi kế toán: tổng phân bổ ${finalCheck} ≠ ${safeTotal}`);
    }

    // Khôi phục thứ tự gốc theo pockets
    const allocMap = new Map(sorted.map((w) => [w.id, w.allocatedAmount]));

    // ── Atomic Prisma Transaction ─────────────────────────────────────────
    await this.prisma.$transaction(
      pockets.map((pocket) => {
        const amount = allocMap.get(pocket.id) ?? 0;
        return this.prisma.pocket.update({
          where: { id: pocket.id },
          data: {
            balance: { increment: new Prisma.Decimal(amount) },
          },
        });
      }),
    );

    return {
      message: 'Đã phân bổ thành công!',
      distributedAmount: safeTotal,
      updatedPockets: await this.getUserPockets(userId),
    };
  }
}

