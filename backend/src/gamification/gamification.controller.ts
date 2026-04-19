import { Controller, Post, Get, Put, Delete, Body, Req, Param, UseGuards, Query } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('goals')
  async getGoals(@Req() req: any) {
    const userId = req.user?.sub;
    return this.gamificationService.getGoals(userId);
  }

  @Get('badges')
  async getBadges(@Req() req: any) {
    const userId = req.user?.sub;
    return this.gamificationService.getBadges(userId);
  }

  @Post('goals')
  async createGoal(@Body() body: any, @Req() req: any) {
    const userId = req.user?.sub;
    return this.gamificationService.createCustomGoal(userId, body);
  }

  @Put('goals/:id')
  async updateGoal(@Param('id') goalId: string, @Body() body: any, @Req() req: any) {
    const userId = req.user?.sub;
    return this.gamificationService.updateGoal(userId, goalId, body);
  }

  @Delete('goals/:id')
  async deleteGoal(
    @Param('id') goalId: string, 
    @Query('refundTarget') refundTarget: string,
    @Req() req: any
  ) {
    const userId = req.user?.sub;
    return this.gamificationService.deleteGoal(userId, goalId, refundTarget);
  }

  @Post('goals/fund')
  async fundGoal(@Body() body: { goalId: string; amount: number }, @Req() req: any) {
    const userId = req.user?.sub;
    return this.gamificationService.addFundsToGoal(userId, body.goalId, body.amount);
  }

  @Post('evaluate')
  async evaluateBadges(@Req() req: any) {
    const userId = req.user?.sub;
    return this.gamificationService.evaluateBadges(userId);
  }

  @Get('points/history')
  async getPointHistory(@Req() req: any) {
    const userId = req.user?.sub;
    return this.gamificationService.getPointHistory(userId);
  }
}
