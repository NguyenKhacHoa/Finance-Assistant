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

  // Xóa hũ (Có kiểm tra bảo mật tiền dư)
  async deletePocket(userId: string, pocketId: string) {
    const pocket = await this.prisma.pocket.findUnique({ where: { id: pocketId } });
    if (!pocket || pocket.userId !== userId) throw new BadRequestException('Hũ không hợp lệ');
    if (Number(pocket.balance) > 0) throw new BadRequestException('Bạn phải chuyển hết tiền sang hũ khác trước khi xóa');
    
    await this.prisma.pocket.delete({ where: { id: pocketId } });
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

  // Logic phân bổ thu nhập (Lương) vào 6 hũ
  async distributeIncome(userId: string, totalAmount: number) {
    if (totalAmount <= 0) {
      throw new BadRequestException('Số tiền thu nhập phải lớn hơn 0');
    }

    let pockets = await this.getUserPockets(userId);
    
    // Nếu user chưa có hũ nào, tự động khởi tạo theo quy tắc chuẩn
    if (pockets.length === 0) {
      pockets = await this.initializeDefaultPockets(userId);
    }

    // Kiểm tra tổng % có bằng 100% không để đề phòng lỗi logic từ người dùng
    const totalPercentage = pockets.reduce((acc, pocket) => acc + Number(pocket.percentage), 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new BadRequestException('Tổng tỷ lệ các hũ phải bằng 100%');
    }

    // Sử dụng Prisma Transaction để đảm bảo tính ACID
    // Nếu cập nhật 1 hũ lỗi, toàn bộ process sẽ rollback
    const transactions = [];

    // 1. Tạo Transaction kỷ lục cho thu nhập tổng hợp
    // Lấy hũ đầu tiên để làm pocketId tham chiếu cho bản ghi tổng thu nhập
    const firstPocketId = pockets[0]?.id;
    if (firstPocketId) {
      transactions.push(
        this.prisma.transaction.create({
          data: {
            userId,
            pocketId: firstPocketId,
            type: 'INCOME',
            amount: new Prisma.Decimal(totalAmount),
            title: 'Nhận Thu Nhập Chờ Phân Bổ',
            category: 'Salary',
          },
        })
      );
    }

    // 2. Tính toán và cộng tiền vào từng hũ
    for (const pocket of pockets) {
      const allocation = (totalAmount * Number(pocket.percentage)) / 100;
      
      transactions.push(
        this.prisma.pocket.update({
          where: { id: pocket.id },
          data: {
            balance: {
              increment: new Prisma.Decimal(allocation),
            },
          },
        })
      );
    }

    await this.prisma.$transaction(transactions);

    return {
      message: 'Đã phân bổ thành công!',
      distributedAmount: totalAmount,
      updatedPockets: await this.getUserPockets(userId),
    };
  }
}
