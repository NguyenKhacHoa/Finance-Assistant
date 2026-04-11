import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { PrismaExceptionFilter } from './prisma-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Cấu hình payload limit để nhận ảnh Base64 OCR (10MB)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors({ origin: '*', credentials: true });
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(3000, '0.0.0.0');
  
  console.log(`\n======================================================`);
  console.log(`🚀 BACKEND API RUNNING ON: http://localhost:3000`);
  console.log(`🌐 MỞ TRANG WEB (FRONTEND) TẠI: http://localhost:5173/`);
  console.log(`======================================================\n`);
}
bootstrap();
