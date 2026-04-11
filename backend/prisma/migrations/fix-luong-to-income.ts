/**
 * Migration Script: Fix LUONG → INCOME
 * Chạy: npx tsx prisma/migrations/fix-luong-to-income.ts
 *
 * Mục đích: Các giao dịch phân bổ lương cũ được lưu với type='LUONG'
 * sẽ được cập nhật lại thành type='INCOME' để thống kê chính xác.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Đang cập nhật giao dịch LUONG → INCOME...');

  const result = await prisma.$executeRaw`
    UPDATE "Transaction"
    SET type = 'INCOME'::"TransactionType"
    WHERE type = 'LUONG'::"TransactionType"
  `;

  console.log(`✅ Đã cập nhật ${result} giao dịch từ LUONG → INCOME.`);
}

main()
  .catch((e) => {
    console.error('❌ Migration thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
