import { Injectable, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class GamificationService implements OnModuleInit {
  private readonly logger = new Logger(GamificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('Kiểm tra và khởi tạo dữ liệu Badges...');
    const badges = [
      // ─ Mới (Tier Cơ Bản) ─
      { name: 'Người Mới Kỷ Luật',    description: 'Tham gia và bắt đầu hành trình quản lý tài chính',      icon: 'Award',  requiredPoints: 100 },
      { name: 'Nhận Lương Đầu Tiên',   description: 'Hoàn thành phân bổ lương lần đầu tiên vào các hũ',           icon: 'Star',   requiredPoints: 100 },
      // ─ Muần tỏ (Tier Trung Bình) ─
      { name: 'Chiến Thần OCR',         description: 'Quét hóa đơn bằng AI thành công 3 lần liên tiếp',           icon: 'Camera', requiredPoints: 300 },
      { name: 'Quản Lý Hũ Thông Thái', description: 'Thiết lập đầy đủ 6 hũ tài chính và duy trì trong 30 ngày',     icon: 'PiggyBank', requiredPoints: 500 },
      { name: 'Chuỗi Đăng Nhập 7 Ngày',  description: 'Đăng nhập và ghi chép giao dịch 7 ngày liên tục',         icon: 'Zap',    requiredPoints: 700 },
      { name: 'Chi Tiêu Thông Thái',    description: 'Chi tiêu dưới mức thiết yếu trong tuần',                      icon: 'Target', requiredPoints: 2000 },
      { name: 'Cao Thủ Săn Sale',       description: 'Sở hữu 5 giao dịch có mã giảm giá',                           icon: 'Zap',    requiredPoints: 1000 },
      // ─ Cũ (Tier Tiếp Theo) ─
      { name: 'Chiến Thần Kỷ Luật',   description: 'Đạt mục tiêu tiết kiệm 3 lần liên tiếp',                icon: 'Target', requiredPoints: 0 },
      { name: 'Bậc Thầy Sinh Tồn',     description: 'Sống sót qua đợt kích hoạt Survival Mode',                icon: 'Zap',    requiredPoints: 0 },
      { name: 'Triệu Phú Tương Lai',   description: 'Tích lũy 10.000 điểm thưởng',                                icon: 'Trophy', requiredPoints: 10000 },
      { name: 'Nhà Tài Phiệt',           description: 'Tích lũy 50.000 điểm thưởng',                                icon: 'Star',   requiredPoints: 50000 },
      { name: 'Người Khởi Đầu',         description: 'Hoàn thành mục tiêu tiết kiệm đầu tiên',                    icon: 'Award',  requiredPoints: 50 },
      { name: 'Chuyên Gia Ngân Sách',   description: 'Tích lũy 500 điểm thưởng',                                 icon: 'Star',   requiredPoints: 500 },
      { name: 'Kiểm Soát Shopping',    description: 'Giới hạn giao dịch mua sắm tháng',                           icon: 'Award',  requiredPoints: 3000 },
      { name: 'Nhà Đầu Tư Trẻ',        description: 'Hoàn thành 3 mục tiêu độc lập',                           icon: 'Trophy', requiredPoints: 20000 },
      { name: 'Siêu Cấp Thắt Lưng',    description: 'Vượt qua tháng khó khăn cực hạn',                          icon: 'Zap',    requiredPoints: 15000 },
      { name: 'Bách Khoa Tài Chính',    description: 'Sưu tầm đầy đủ bài học tài chính',                          icon: 'Star',   requiredPoints: 7500 },
    ];

    for (const badge of badges) {
      await this.prisma.badge.upsert({
        where: { name: badge.name },
        update: {},
        create: badge,
      });
    }
    this.logger.log('Đã cập nhật hệ thống Badges thành công.');
  }

  // Lấy danh sách mục tiêu của user từ DB
  async getGoals(userId: string) {
    return this.prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Lấy danh sách huy hiệu: tất cả badge + trạng thái đã mở khoá hay chưa
  async getBadges(userId: string) {
    const [allBadges, userBadges] = await Promise.all([
      this.prisma.badge.findMany({ orderBy: { requiredPoints: 'asc' } }),
      this.prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true } }),
    ]);

    const unlockedIds = new Set(userBadges.map((ub) => ub.badgeId));

    return allBadges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      requiredPoints: badge.requiredPoints,
      unlocked: unlockedIds.has(badge.id),
    }));
  }

  async createCustomGoal(
    userId: string,
    dto: { title: string; targetAmount: number; deadline?: string; days?: number; icon?: string },
  ) {
    if (!dto.targetAmount || dto.targetAmount <= 0) {
      throw new BadRequestException('Mức tiền phải lớn hơn 0.');
    }

    let deadline: Date | null = null;
    if (dto.deadline) {
      deadline = new Date(dto.deadline);
    } else if (dto.days && dto.days > 0) {
      deadline = new Date();
      deadline.setDate(deadline.getDate() + dto.days);
    }

    return this.prisma.savingsGoal.create({
      data: {
        userId,
        title: dto.title,
        targetAmount: new Prisma.Decimal(dto.targetAmount),
        deadline,
        icon: dto.icon || 'Target',
      },
    });
  }

  async updateGoal(userId: string, goalId: string, dto: { title?: string; targetAmount?: number; deadline?: string | null; icon?: string }) {
    const goal = await this.prisma.savingsGoal.findUnique({ where: { id: goalId } });
    if (!goal || goal.userId !== userId) throw new BadRequestException('Mục tiêu không tồn tại hoặc không có quyền.');

    const data: any = {};
    if (dto.title) data.title = dto.title;
    if (dto.icon) data.icon = dto.icon;
    if (dto.targetAmount && dto.targetAmount > 0) data.targetAmount = new Prisma.Decimal(dto.targetAmount);
    if (dto.deadline !== undefined) data.deadline = dto.deadline ? new Date(dto.deadline) : null;

    return this.prisma.savingsGoal.update({
      where: { id: goalId },
      data,
    });
  }

  async deleteGoal(userId: string, goalId: string, refundTarget?: string) {
    const goal = await this.prisma.savingsGoal.findUnique({ where: { id: goalId } });
    if (!goal || goal.userId !== userId) throw new BadRequestException('Mục tiêu không tồn tại hoặc không có quyền.');

    const currentBal = Number(goal.currentAmount);

    if (currentBal > 0) {
      if (!refundTarget) throw new BadRequestException('Mục tiêu đang có tiền, yêu cầu truyền refundTarget (pocket id hoặc "unallocated")');
      
      let pocketToCreditId = null;

      if (refundTarget === 'unallocated') {
          await this.prisma.user.update({
              where: { id: userId },
              data: { unallocatedBalance: { increment: currentBal } }
          });
      } else {
          const p = await this.prisma.pocket.findUnique({ where: { id: refundTarget } });
          if (!p || p.userId !== userId) throw new BadRequestException('Hũ hoàn trả không tồn tại.');
          await this.prisma.pocket.update({
              where: { id: refundTarget },
              data: { balance: { increment: currentBal } }
          });
          pocketToCreditId = p.id;
      }

      await this.prisma.transaction.create({
          data: {
              userId,
              pocketId: pocketToCreditId,
              amount: currentBal,
              type: 'INCOME',
              title: `Hoàn tiền từ mục tiêu: ${goal.title}`,
              category: 'Other',
              metadata: { source: 'goal_refund', goalId: goal.id }
          }
      });
    }

    return this.prisma.savingsGoal.delete({ where: { id: goalId } });
  }

  // Cập nhật số tiền vào mục tiêu và trao điểm thưởng nếu hoàn thành
  async addFundsToGoal(userId: string, goalId: string, amount: number) {
    if (amount <= 0) throw new BadRequestException('Số tiền nạp phải lớn hơn 0.');
    
    // 1. Kiểm tra Goal
    const goal = await this.prisma.savingsGoal.findUnique({ where: { id: goalId } });
    if (!goal || goal.userId !== userId)
      throw new BadRequestException('Mục tiêu không tồn tại hoặc không có quyền.');
    if (goal.status !== 'ACTIVE') throw new BadRequestException('Mục tiêu đã đóng.');

    // 2. Kiểm tra số dư Chưa phân bổ (Unallocated)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const unallocatedPocket = await this.prisma.pocket.findFirst({
      where: { userId, name: 'Tiền chưa vào hũ' }
    });

    const userUnbal = Number(user?.unallocatedBalance || 0);
    const pocketUnbal = Number(unallocatedPocket?.balance || 0);
    const totalUnallocated = userUnbal + pocketUnbal;

    if (amount > totalUnallocated) {
        throw new BadRequestException('Không đủ số dư chưa phân bổ để thực hiện.');
    }

    // 3. Thực hiện trừ tiền
    let remainingToDeduct = amount;

    if (unallocatedPocket && pocketUnbal > 0) {
        const deductFromPocket = Math.min(pocketUnbal, remainingToDeduct);
        await this.prisma.pocket.update({
            where: { id: unallocatedPocket.id },
            data: { balance: { decrement: deductFromPocket } }
        });
        remainingToDeduct -= deductFromPocket;
    }

    if (remainingToDeduct > 0) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { unallocatedBalance: { decrement: remainingToDeduct } }
        });
    }

    // Ghi log giao dịch để cân đối Dashboard
    await this.prisma.transaction.create({
      data: {
        userId,
        pocketId: unallocatedPocket ? unallocatedPocket.id : null,
        amount,
        type: 'EXPENSE',
        title: `Nạp tiền vào mục tiêu: ${goal.title}`,
        category: 'Other',
        metadata: { source: 'goal_funding', goalId }
      }
    });

    const newAmount = Number(goal.currentAmount) + amount;
    const target = Number(goal.targetAmount);

    let updatedStatus = 'ACTIVE';
    let rewardPoints = 0;

    // Nếu đạt mục tiêu
    if (newAmount >= target) {
      updatedStatus = 'COMPLETED';
      rewardPoints = Math.floor(Math.random() * (200 - 50 + 1)) + 50;
      await this.awardPoints(userId, rewardPoints, `Hoàn thành mục tiêu: ${goal.title}`);
    } else {
      // Thưởng 10 điểm khi nạp quỹ
      await this.awardPoints(userId, 10, `Nạp quỹ mục tiêu: ${goal.title}`);
    }

    const updatedGoal = await this.prisma.savingsGoal.update({
      where: { id: goalId },
      data: {
        currentAmount: new Prisma.Decimal(newAmount),
        status: updatedStatus,
      },
    });

    return {
      message:
        updatedStatus === 'COMPLETED'
          ? `Chúc mừng! Bạn đã hoàn thành mục tiêu và nhận được ${rewardPoints} Điểm thưởng.`
          : 'Đã nạp thêm quỹ vào mục tiêu.',
      rewardPoints,
      goal: updatedGoal,
    };
  }

  // Đánh giá và trao huy hiệu tự động theo điểm thưởng hiện tại
  async evaluateBadges(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { badges: true },
    });
    if (!user) return;

    const allBadges = await this.prisma.badge.findMany({
      orderBy: { requiredPoints: 'asc' },
    });

    const currentBadgeIds = user.badges.map((ub) => ub.badgeId);
    const newBadges: string[] = [];

    for (const badge of allBadges) {
      if (
        user.rewardPoints >= badge.requiredPoints &&
        !currentBadgeIds.includes(badge.id)
      ) {
        await this.prisma.userBadge.create({
          data: { userId: user.id, badgeId: badge.id },
        });
        newBadges.push(badge.name);
      }
    }

    return { newlyUnlocked: newBadges };
  }
  // ── Shortcut: check hành đạt thành tích ──
  async checkAchievements(userId: string): Promise<string[]> {
    return (await this.evaluateBadges(userId))?.newlyUnlocked ?? [];
  }

  // ── Ghi điểm + tự động mở khóa huy hiệu ──
  async awardPoints(userId: string, delta: number, reason: string): Promise<string[]> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { rewardPoints: { increment: delta } } }),
      this.prisma.pointLog.create({ data: { userId, delta, reason } }),
    ]);
    // Kiểm tra và mở khóa huy hiệu mới
    return (await this.evaluateBadges(userId))?.newlyUnlocked ?? [];
  }

  // ── Lịch sử điểm thưởng ──
  async getPointHistory(userId: string, take = 50) {
    return this.prisma.pointLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
