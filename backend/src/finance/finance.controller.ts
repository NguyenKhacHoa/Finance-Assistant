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

  // ── Bước 1: Nạp tiền vào "Chưa phân bổ" ──────────────────────────────────
  @Post('deposit')
  async deposit(
    @Body() body: { amount: number; note?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.sub;
    return this.financeService.depositToUnallocated(userId, body.amount, body.note);
  }

  // ── Bước 2 (tuỳ chọn): Phân bổ từ "Chưa phân bổ" vào các hũ ────────────
  @Post('distribute-from-unallocated')
  async distributeFromUnallocated(
    @Body() body: { allocations: { pocketId: string; amount: number }[] },
    @Req() req: any,
  ) {
    const userId = req.user?.sub;
    return this.financeService.distributeFromUnallocated(userId, body.allocations);
  }
}
