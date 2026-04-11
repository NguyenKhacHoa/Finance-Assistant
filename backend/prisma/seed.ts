import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding badges...');

  const badges = [
    {
      name: 'Chiến Thần Kỷ Luật',
      description: 'Đạt mục tiêu tiết kiệm 3 lần liên tiếp',
      icon: 'Target',
      requiredPoints: 0, // Trao thủ công qua evaluateBadges khi đạt điều kiện
    },
    {
      name: 'Bậc Thầy Sinh Tồn',
      description: 'Sống sót qua đợt kích hoạt Survival Mode',
      icon: 'Zap',
      requiredPoints: 0,
    },
    {
      name: 'Triệu Phú Tương Lai',
      description: 'Tích lũy 10.000 điểm thưởng',
      icon: 'Trophy',
      requiredPoints: 10000,
    },
    {
      name: 'Nhà Tài Phiệt',
      description: 'Tích lũy 50.000 điểm thưởng',
      icon: 'Star',
      requiredPoints: 50000,
    },
    {
      name: 'Người Khởi Đầu',
      description: 'Hoàn thành mục tiêu tiết kiệm đầu tiên',
      icon: 'Award',
      requiredPoints: 50,
    },
    {
      name: 'Chuyên Gia Ngân Sách',
      description: 'Tích lũy 500 điểm thưởng',
      icon: 'Star',
      requiredPoints: 500,
    },
  ];

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: { description: badge.description, icon: badge.icon, requiredPoints: badge.requiredPoints },
      create: badge,
    });
    console.log(`  ✅ Badge: "${badge.name}"`);
  }

  console.log('✅ Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
