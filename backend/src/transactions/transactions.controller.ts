import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async getTransactions(@Req() req: any) {
    const userId = req.user?.sub;
    return this.transactionsService.getTransactions(userId);
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    const userId = req.user?.sub;
    return this.transactionsService.getMonthlyStats(userId);
  }

  @Get('chart')
  async getChartData(@Req() req: any, @Query('period') period: string) {
    const userId = req.user?.sub;
    const days = period === '1m' ? 30 : 7;
    return this.transactionsService.getChartData(userId, days);
  }

  @Post('create')
  async createTransaction(@Body() body: any, @Req() req: any) {
    const userId = req.user?.sub;
    return this.transactionsService.createTransaction(userId, body);
  }
}
