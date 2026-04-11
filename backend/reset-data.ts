import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Wiping all financial data to reset state ---');
  
  // 1. Delete all transactions
  const deletedTx = await prisma.transaction.deleteMany();
  console.log(`Deleted ${deletedTx.count} transactions.`);

  // 2. Reset all pocket balances to 0
  const updatedPockets = await prisma.pocket.updateMany({
    data: { balance: 0 }
  });
  console.log(`Reset ${updatedPockets.count} pockets to 0 balance.`);

  // 3. Reset unallocatedBalance to 0 for all users
  const updatedUsers = await prisma.user.updateMany({
    data: { unallocatedBalance: 0 }
  });
  console.log(`Reset unallocatedBalance for ${updatedUsers.count} users.`);

  // 4. Restore Bánh mì transaction
  const foodPocket = await prisma.pocket.findFirst({ where: { name: 'Ăn uống' } });
  if (foodPocket) {
    const user = await prisma.user.findFirst();
    if (user) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          pocketId: foodPocket.id,
          amount: 15000,
          type: 'EXPENSE',
          title: 'Bánh mì',
          category: 'Food',
        }
      });
      await prisma.pocket.update({
        where: { id: foodPocket.id },
        data: { balance: -15000 }
      });
      console.log('Restored Bánh mì transaction.');
    }
  }

  console.log('--- DB Reset Complete. Ready for clean test. ---');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
