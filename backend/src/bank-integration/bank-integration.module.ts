import { Module } from '@nestjs/common';
import { BankIntegrationController } from './bank-integration.controller';
import { BankIntegrationService } from './bank-integration.service';
import { TransactionClassifierService } from './transaction-classifier.service';
import { AiModule } from '../ai/ai.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [AiModule, AlertsModule],
  controllers: [BankIntegrationController],
  providers: [BankIntegrationService, TransactionClassifierService],
  exports: [BankIntegrationService],
})
export class BankIntegrationModule { }
