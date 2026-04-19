import { Controller, Post, Body, Param, Headers, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { BankIntegrationService } from './bank-integration.service';

interface WebhookPayload {
  amount: number;
  description: string;
  transactionDate?: string;
  when?: string;
  tid?: string; // transaction id
}

@Controller('webhooks/bank-handler')
export class BankIntegrationController {
  constructor(private readonly bankIntegrationService: BankIntegrationService) {}

  @Post(':webhookToken')
  async handleWebhook(
    @Param('webhookToken') webhookToken: string,
    @Headers('secure-token') secureToken: string,
    @Headers('x-api-key') apiKey: string,
    @Body() payload: WebhookPayload,
  ) {
    // Basic verification - checking if request contains expected signature/token
    const expectedToken = process.env.WEBHOOK_SECURE_TOKEN;
    if (expectedToken && secureToken !== expectedToken && apiKey !== expectedToken) {
      throw new UnauthorizedException('Invalid secure-token or API key');
    }

    if (!payload || typeof payload.amount !== 'number') {
      return { success: false, message: 'Invalid payload amount' };
    }

    const transactionId = payload.tid || Date.now().toString();

    // Call service to process
    return this.bankIntegrationService.processTransaction(
      webhookToken,
      payload.amount,
      payload.description,
      payload.when || payload.transactionDate,
      transactionId,
    );
  }
}
