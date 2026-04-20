import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===============================
  // Fixed Expenses
  // ===============================

  async getFixedExpenses(userId: string) {
    return this.prisma.fixedExpense.findMany({
      where: { userId },
      include: { pocket: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addFixedExpense(
    userId: string,
    title: string,
    amount: number,
    autoDeduct: boolean,
    pocketId?: string,
  ) {
    return this.prisma.fixedExpense.create({
      data: {
        userId,
        title,
        amount,
        autoDeduct,
        ...(pocketId && { pocketId }),
      },
    });
  }

  async updateFixedExpense(
    userId: string,
    expenseId: string,
    title: string,
    amount: number,
    autoDeduct: boolean,
    pocketId?: string,
  ) {
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
        ...(pocketId && { pocketId }),
      },
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
      data: { passwordHash: newHash },
    });

    return { success: true, message: 'Đổi mật khẩu thành công.' };
  }

  // ═══════════════════════════════════════════════════════════════
  // HARD DELETE ACCOUNT — Xóa toàn bộ dữ liệu người dùng
  // ═══════════════════════════════════════════════════════════════
  /**
   * Xóa cứng (hard delete) toàn bộ dữ liệu của người dùng theo đúng
   * thứ tự phụ thuộc khóa ngoại (FK) để tránh constraint errors.
   *
   * Thứ tự xóa (từ leaf → root):
   *  1. PointLog               (FK → User)
   *  2. UserBadge              (FK → User, Badge)
   *  3. Transactions           (FK → User, Pocket, SavingsGoal)
   *     ↑ PHẢI xóa TRƯỚC SavingsGoal vì Transaction.goalId → SavingsGoal
   *     ↑ PHẢI xóa TRƯỚC Pocket vì Transaction.pocketId → Pocket
   *  4. FixedExpenses          (FK → User, Pocket)
   *     ↑ PHẢI xóa TRƯỚC Pocket vì FixedExpense.pocketId → Pocket
   *  5. SavingsGoal            (FK → User)
   *  6. SurvivalConfig         (FK → User, @unique)
   *  7. Pockets                (FK → User)
   *  8. User                   (root record — Google OAuth ID cũng bị xóa cùng)
   *
   * Toàn bộ thực hiện trong 1 Prisma transaction (atomic):
   * nếu 1 bước thất bại → rollback tất cả.
   */
  async deleteAccount(userId: string) {
    // Xác minh user tồn tại trước khi thực hiện
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, googleId: true, name: true },
    });

    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản.');
    }

    this.logger.log(
      `[DeleteAccount] Bắt đầu xóa: userId=${userId}, ` +
      `email=${user.email}, googleAuth=${!!user.googleId}`,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        // ── 1. PointLog ──────────────────────────────────────────────────
        const r1 = await (tx as any).pointLog.deleteMany({ where: { userId } });
        this.logger.debug(`  [1/8] PointLog: ${r1.count} bản ghi đã xóa`);

        // ── 2. UserBadge ─────────────────────────────────────────────────
        const r2 = await (tx as any).userBadge.deleteMany({ where: { userId } });
        this.logger.debug(`  [2/8] UserBadge: ${r2.count} bản ghi đã xóa`);

        // ── 3. Transactions (TRƯỚC SavingsGoal & Pocket) ─────────────────
        // Transaction.goalId → SavingsGoal: xóa Transaction trước để tránh
        // "Foreign key constraint failed" khi xóa SavingsGoal ở bước 5.
        // Transaction.pocketId → Pocket: tương tự, tránh violation bước 7.
        const r3 = await (tx as any).transaction.deleteMany({ where: { userId } });
        this.logger.debug(`  [3/8] Transaction: ${r3.count} bản ghi đã xóa`);

        // ── 4. FixedExpenses (TRƯỚC Pocket) ──────────────────────────────
        // FixedExpense.pocketId → Pocket (không có onDelete: Cascade trong schema)
        // → phải xóa thủ công trước khi xóa Pocket.
        const r4 = await (tx as any).fixedExpense.deleteMany({ where: { userId } });
        this.logger.debug(`  [4/8] FixedExpense: ${r4.count} bản ghi đã xóa`);

        // ── 5. SavingsGoal ───────────────────────────────────────────────
        const r5 = await (tx as any).savingsGoal.deleteMany({ where: { userId } });
        this.logger.debug(`  [5/8] SavingsGoal: ${r5.count} bản ghi đã xóa`);

        // ── 6. SurvivalConfig ────────────────────────────────────────────
        const r6 = await (tx as any).survivalConfig.deleteMany({ where: { userId } });
        this.logger.debug(`  [6/8] SurvivalConfig: ${r6.count} bản ghi đã xóa`);

        // ── 7. Pockets ───────────────────────────────────────────────────
        const r7 = await (tx as any).pocket.deleteMany({ where: { userId } });
        this.logger.debug(`  [7/8] Pocket: ${r7.count} bản ghi đã xóa`);

        // ── 8. User (root) ───────────────────────────────────────────────
        // Hard delete User record. googleId field bị xóa theo cùng row này.
        // Không cần xóa Google OAuth riêng vì đây chỉ là data column trong User.
        await (tx as any).user.delete({ where: { id: userId } });
        this.logger.debug(
          `  [8/8] User deleted (id=${userId}, googleId=${user.googleId ?? 'không có'})`,
        );
      });

      this.logger.log(
        `[DeleteAccount] ✅ Xóa tài khoản hoàn tất: ${user.email} (${userId})`,
      );

      return {
        success: true,
        message: 'Đã xóa tài khoản và toàn bộ dữ liệu liên quan vĩnh viễn.',
      };
    } catch (error: any) {
      this.logger.error(
        `[DeleteAccount] ❌ Thất bại khi xóa userId=${userId}: ${error?.message}`,
        error?.stack,
      );

      // Dev: trả về chi tiết lỗi để debug. Prod: ẩn chi tiết.
      const isDev = process.env.NODE_ENV !== 'production';
      throw new InternalServerErrorException(
        isDev
          ? `Lỗi khi xóa tài khoản: ${error?.message}`
          : 'Đã xảy ra lỗi khi xóa tài khoản. Vui lòng thử lại sau.',
      );
    }
  }

  async updateProfile(
    userId: string,
    data: { name?: string; avatarUrl?: string; phone?: string; currentPassword?: string },
  ) {
    const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[6-9]|7[06-9]|8[1-9]|9[0-9])\d{7}$/;
    if (data.phone && !PHONE_REGEX.test(data.phone)) {
      throw new BadRequestException('Số điện thoại không đúng định dạng Việt Nam.');
    }
    if (data.name !== undefined && data.name.trim().length < 2) {
      throw new BadRequestException('Họ và tên phải có ít nhất 2 ký tự.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Không tìm thấy người dùng');
    }

    if (data.phone && data.phone !== user.phone && user.passwordHash) {
      if (!data.currentPassword) {
        throw new BadRequestException('Mật khẩu xác nhận không chính xác.'); // Bắt buộc báo lỗi nếu thiếu
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new BadRequestException('Mật khẩu xác nhận không chính xác.');
      }
    }

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
        role: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // UNLINK BANK — Hủy liên kết & xóa dấu vết 
  // ═══════════════════════════════════════════════════════════════
  /**
   * 1. Hủy trạng thái bankLinked về false
   * 2. Xóa bỏ webhookToken
   * 3. Xóa trường description & bankTransactionId của toàn bộ giao dịch Bank
   * để không để lại dấu vết nội dung chuyển khoản nhạy cảm (Private Data Wipe). 
   */
  async unlinkBank(userId: string) {
    this.logger.log(`[UnlinkBank] Đang tiến hành ngắt kết nối Bank cho user: ${userId}`);

    await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật User status
      await tx.user.update({
        where: { id: userId },
        data: {
          bankLinked: false,
          webhookToken: null,
        },
      });

      // 2. Clear metadata nhạy cảm trong hệ thống
      const wipedTxs = await (tx as any).transaction.updateMany({
        where: {
          userId: userId,
          source: 'BANK',
        },
        data: {
          description: null,
          bankTransactionId: null,
          // Có thể giữ lại amount / category để không làm lệch số liệu thống kê.
        },
      });

      this.logger.debug(`  Đã làm sạch lịch sử nội dung cho ${wipedTxs.count} giao dịch BANK.`);
    });

    return { success: true, message: 'Đã hủy liên kết và xóa sạch lịch sử nội dung ngân hàng.' };
  }

  // ═══════════════════════════════════════════════════════════════
  // GET WEBHOOK INFO
  // ═══════════════════════════════════════════════════════════════
  async getWebhookInfo(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { webhookToken: true, bankLinked: true },
    });

    if (!user) {
      throw new BadRequestException('Không tìm thấy user.');
    }

    // Nếu lỡ chưa có (hoặc đã hủy BankLinked và bị null), cấp mới cho họ link để setup lại.
    if (!user.webhookToken) {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { webhookToken: crypto.randomUUID() },
        select: { webhookToken: true, bankLinked: true },
      });
    }

    return {
      webhookToken: user.webhookToken,
      bankLinked: user.bankLinked,
      webhookUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/webhooks/bank-handler/${user.webhookToken}`
    };
  }
}
