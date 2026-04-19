import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsGateway } from '../alerts/alerts.gateway';
import { TransactionClassifierService } from './transaction-classifier.service';
import { TransactionSource, TransactionType, TransactionCategory } from '@prisma/client';

@Injectable()
export class BankIntegrationService {
  private readonly logger = new Logger(BankIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsGateway: AlertsGateway,
    private readonly classifierSvc: TransactionClassifierService,
  ) { }

  async processTransaction(
    webhookToken: string,
    amount: number,
    description: string,
    date: string | undefined,
    tid: string,
  ) {
    this.logger.log(`Received Webhook: [Token: ${webhookToken}] Amount: ${amount}`);

    // 1. Tìm User qua webhookToken
    const user = await this.prisma.user.findUnique({
      where: { webhookToken },
    });

    if (!user) {
      throw new NotFoundException('User with this webhook token not found');
    }

    // 2. Chống trùng lặp (Idempotency check)
    const existingTx = await this.prisma.transaction.findUnique({
      where: { bankTransactionId: tid },
    });

    if (existingTx) {
      this.logger.warn(`Duplicate transaction ignored: ${tid} for User ${user.email}`);
      return { success: true, message: 'Transaction already processed', ignored: true };
    }

    let createdTransaction;

    // 3. Xử lý phân luồng Tăng / Giảm
    if (amount > 0) {
      // THU NHẬP: Tiền tự động gán vào Chưa Phân Bổ (Unallocated Balance)
      createdTransaction = await this.prisma.$transaction(async (tx) => {
        const trX = await tx.transaction.create({
          data: {
            userId: user.id,
            amount: amount,
            type: TransactionType.INCOME,
            source: TransactionSource.BANK,
            title: 'Tiền vào: ' + (description || 'Nạp qua ngân hàng'),
            description: description,
            bankTransactionId: tid,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: { unallocatedBalance: { increment: amount } },
        });

        return trX;
      });

    } else if (amount < 0) {
      // CHI TIÊU: Regex phân nhóm & tìm hũ phù hợp (nếu regex thất bại thì có thể gọi AI fallback)
      const expenseAmount = Math.abs(amount);

      const classification = await this.classifierSvc.classify(user.id, description);

      const targetPocketId = classification.targetPocket?.id || null;
      const finalCategory = classification.category || TransactionCategory.Other;

      createdTransaction = await this.prisma.$transaction(async (tx) => {
        const trY = await tx.transaction.create({
          data: {
            userId: user.id,
            amount: expenseAmount,
            type: TransactionType.EXPENSE,
            source: TransactionSource.BANK,
            title: 'Chi tiêu: ' + (classification.suggestedName || 'Tự động'),
            description: description,
            category: finalCategory,
            pocketId: targetPocketId,
            bankTransactionId: tid,
            metadata: {
              needsManualReview: !targetPocketId,
              autoClassified: true
            }
          },
        });

        if (targetPocketId) {
          // Trừ trực tiếp vào Hũ (Pocket)
          await tx.pocket.update({
            where: { id: targetPocketId },
            data: { balance: { decrement: expenseAmount } },
          });
        } else {
          // Nếu không tìm ra hũ khớp, giữ nguyên ở Chưa phân loại (trừ tiền ở quỹ chung)
          await tx.user.update({
            where: { id: user.id },
            data: { unallocatedBalance: { decrement: expenseAmount } },
          });
        }

        return trY;
      });
    } else {
      return { success: true, message: 'Amount is 0, ignored.' };
    }

    // 4. Phát sự kiện Real-time báo cho Frontend Dashboard
    this.alertsGateway.sendBankTransactionAlert(user.id, {
      transactionId: createdTransaction.id,
      amount: amount,
      title: createdTransaction.title,
      description: description,
      date: date || new Date().toISOString(),
    });

    return { success: true, transactionId: createdTransaction.id };
  }
}
