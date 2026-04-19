import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // ─── Fixed Expenses ──────────────────────────────────────────

  @Get('fixed-expenses')
  async getFixedExpenses(@Req() req: any) {
    const userId = req.user.sub;
    return this.profileService.getFixedExpenses(userId);
  }

  @Post('fixed-expenses')
  async addFixedExpense(@Req() req: any, @Body() body: { title: string; amount: number; autoDeduct: boolean; pocketId?: string }) {
    const userId = req.user.sub;
    return this.profileService.addFixedExpense(userId, body.title, body.amount, body.autoDeduct ?? true, body.pocketId);
  }

  @Put('fixed-expenses/:id')
  async updateFixedExpense(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { title: string; amount: number; autoDeduct: boolean; pocketId?: string }
  ) {
    const userId = req.user.sub;
    return this.profileService.updateFixedExpense(userId, id, body.title, body.amount, body.autoDeduct, body.pocketId);
  }

  @Delete('fixed-expenses/:id')
  async deleteFixedExpense(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.sub;
    return this.profileService.deleteFixedExpense(userId, id);
  }

  // ─── Profile Info & Settings ──────────────────────────────────

  @Put('info')
  async updateProfileInfo(@Req() req: any, @Body() body: { name?: string; avatarUrl?: string; phone?: string }) {
    const userId = req.user.sub;
    return this.profileService.updateProfile(userId, body);
  }

  @Post('change-password')
  async changePassword(@Req() req: any, @Body() body: { oldPass: string; newPass: string }) {
    const userId = req.user.sub;
    return this.profileService.changePassword(userId, body.oldPass, body.newPass);
  }

  @Delete('account')
  async deleteAccount(@Req() req: any) {
    const userId = req.user.sub;
    return this.profileService.deleteAccount(userId);
  }

  @Post('unlink-bank')
  async unlinkBank(@Req() req: any) {
    const userId = req.user.sub;
    return this.profileService.unlinkBank(userId);
  }

  @Get('webhook-info')
  async getWebhookInfo(@Req() req: any) {
    const userId = req.user.sub;
    return this.profileService.getWebhookInfo(userId);
  }
}
