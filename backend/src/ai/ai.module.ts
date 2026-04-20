import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PocketsModule } from '../pockets/pockets.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { AlertsModule } from '../alerts/alerts.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    PrismaModule,
    // Lưu file upload tạm vào RAM (không ghi đĩa), giới hạn 10MB
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
    // Import các module cần thiết để AiService có thể sử dụng service từ các module này
    // forwardRef() phòng ngừa lỗi Circular Dependency nếu xảy ra trong tương lai
    forwardRef(() => PocketsModule),
    forwardRef(() => TransactionsModule),
    forwardRef(() => AlertsModule),
    forwardRef(() => FinanceModule),
  ],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
