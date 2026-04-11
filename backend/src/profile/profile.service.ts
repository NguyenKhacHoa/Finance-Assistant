import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  // ===============================
  // Fixed Expenses
  // ===============================
  
  async getFixedExpenses(userId: string) {
    return this.prisma.fixedExpense.findMany({
      where: { userId },
      include: { pocket: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async addFixedExpense(userId: string, title: string, amount: number, autoDeduct: boolean, pocketId?: string) {
    return this.prisma.fixedExpense.create({
      data: {
        userId,
        title,
        amount,
        autoDeduct,
        ...(pocketId && { pocketId })
      }
    });
  }

  async updateFixedExpense(userId: string, expenseId: string, title: string, amount: number, autoDeduct: boolean, pocketId?: string) {
    const expense = await this.prisma.fixedExpense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.userId !== userId) {
      throw new BadRequestException('Expense không tồn tại hoặc không có quyền.');
    }
    return this.prisma.fixedExpense.update({
      where: { id: expenseId },
      data: { 
        title, 
        amount, 
        autoDeduct,
        ...(pocketId && { pocketId }) 
      }
    });
  }

  async deleteFixedExpense(userId: string, expenseId: string) {
    const expense = await this.prisma.fixedExpense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.userId !== userId) {
      throw new BadRequestException('Expense không tồn tại hoặc không có quyền.');
    }
    await this.prisma.fixedExpense.delete({ where: { id: expenseId } });
    return { success: true };
  }

  // ===============================
  // Profile Security
  // ===============================
  
  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Không tìm thấy người dùng');
    if (!user.passwordHash) throw new BadRequestException('Tài khoản này đăng nhập qua Google Auth.');

    const isValid = await bcrypt.compare(oldPass, user.passwordHash);
    if (!isValid) throw new BadRequestException('Mật khẩu cũ không chính xác.');

    const newHash = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash }
    });

    return { success: true, message: 'Đổi mật khẩu thành công.' };
  }

  async deleteAccount(userId: string) {
    try {
      // Due to onDelete: Cascade in schema.prisma, this deletes User and all related Pocket, Transaction, etc.
      await this.prisma.user.delete({ where: { id: userId } });
      return { success: true, message: 'Đã xóa tài khoản vĩnh viễn.' };
    } catch (e) {
      throw new InternalServerErrorException('Lỗi khi xóa tài khoản.');
    }
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string; phone?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
        ...(data.phone && { phone: data.phone }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        role: true
      }
    });
  }
}
