import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PocketsModule } from './pockets/pockets.module';
import { AiModule } from './ai/ai.module';
import { AlertsModule } from './alerts/alerts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { GamificationModule } from './gamification/gamification.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { FinanceModule } from './finance/finance.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PocketsModule,
    AiModule,
    AlertsModule,
    TransactionsModule,
    GamificationModule,
    AdminModule,
    ProfileModule,
    FinanceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

