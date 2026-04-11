import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(userId: string) {
    // 1. Kiểm tra Quyền (Role-based access)
    const admin = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!admin || admin.role !== 'ADMIN') {
      throw new ForbiddenException('Truy cập bị từ chối: Khu vực dành riêng cho Quản trị viên.');
    }

    // 2. Aggregate Data
    const totalUsers = await this.prisma.user.count();
    
    // Tính tổng tất cả tài sản đang được quản lý (Tổng balance của tất cả Pockets)
    const aggregateAssets = await this.prisma.pocket.aggregate({
      _sum: {
        balance: true
      }
    });

    const activeGoals = await this.prisma.savingsGoal.count({
      where: { status: 'ACTIVE' }
    });

    const completedGoals = await this.prisma.savingsGoal.count({
      where: { status: 'COMPLETED' }
    });

    // Lấy top 5 người dùng có điểm cao nhất (Leaderboard)
    const leaderboard = await this.prisma.user.findMany({
      take: 5,
      orderBy: { rewardPoints: 'desc' },
      select: { email: true, name: true, rewardPoints: true, loginStreak: true }
    });

    return {
      overview: {
        totalUsers,
        totalAssets: aggregateAssets._sum.balance || 0,
        activeGoals,
        completedGoals
      },
      leaderboard
    };
  }
}
