import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('ai-preview')
  async getAiPreview(@Body() body: { amount: number }, @Req() req: any) {
    const userId = req.user?.sub;
    return this.financeService.getAiSalaryPreview(userId, body.amount);
  }

  @Post('distribute-salary')
  async distributeSalary(
    @Body() body: { totalAmount: number; allocations?: { pocketId: string, amount: number }[] },
    @Req() req: any
  ) {
    const userId = req.user?.sub;
    return this.financeService.distributeSalary(userId, body.totalAmount, body.allocations);
  }
}
