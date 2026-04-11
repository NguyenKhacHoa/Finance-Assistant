import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI, SchemaType, ResponseSchema } from '@google/generative-ai';
import { GamificationService } from '../gamification/gamification.service';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly DEFAULT_MODEL = 'gemini-2.5-flash';

  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
  }

  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastError = err;
        this.logger.warn(`AI Call Attempt ${attempt} failed: ${err?.message || err}`);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
        }
      }
    }
    throw lastError;
  }

  async getAiSalaryPreview(userId: string, totalAmount: number) {
    const pockets = await this.prisma.pocket.findMany({ where: { userId } });
    if (pockets.length === 0) throw new BadRequestException('Bạn chưa thiết lập hũ tài chính.');

    const schema: ResponseSchema = {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          pocketId: { type: SchemaType.STRING },
          amount: { type: SchemaType.NUMBER },
        },
        required: ["pocketId", "amount"],
      }
    };

    const model = this.genAI.getGenerativeModel({
      model: this.DEFAULT_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
      systemInstruction: `Bạn là trợ lý ảo AI tài chính chuyên nghiệp. Hãy phân bổ toàn bộ số tiền lương (${totalAmount} VNĐ) vào các hũ tài chính của người dùng dựa trên chiến lược quản lý rủi ro và các yếu tố như số dư bị cạn kiệt, mục tiêu quan trọng. QUAN TRỌNG: Tổng amount của các hũ phải đúng bằng ${totalAmount}. Trả về JSON Array.`
    }, { apiVersion: 'v1beta' });

    const pocketsInfo = pockets.map(p => `ID: ${p.id}, Tên: ${p.name}, Số dư hiện tại: ${p.balance}, Tỷ lệ chuẩn định kỳ: ${p.percentage}%`).join('\n');
    
    return this.withRetry(async () => {
      try {
        const prompt = `Tổng lương tuần này: ${totalAmount} VNĐ.\n\nThông tin hũ hiện tại của tôi:\n${pocketsInfo}\n\nHãy quyết định phân bổ số tiền. Trả về mảng JSON.`;
        const result = await model.generateContent(prompt);
        const data = JSON.parse(result.response.text());
        return data;
      } catch (error: any) {
        this.logger.error("AI Split failed: " + error.message);
        throw new BadRequestException('Lỗi máy chủ AI (503 Capacity Exhausted). Đã thử lại nhưng mạng quá tải.');
      }
    }, 4);
  }

  /**
   * Phân bổ lương vào các hũ theo quy trình chuẩn kế toán:
   *
   * B1. Trừ chi phí cố định ra khỏi tổng lương → còn `distributable`
   * B2. Phân bổ `allocations` (do User/AI đề xuất) vào từng hũ
   * B3. Phần tiền thừa (do % hũ < 100%) → tự động vào hũ Thiết Yếu
   * B4. Chi phí cố định → nạp thẳng vào hũ được liên kết (hoặc hũ Thiết Yếu)
   *
   * Kết quả: 100% lương hạch toán vào hệ thống, không đồng nào mất.
   */
  async distributeSalary(
    userId: string,
    totalAmount: number,
    allocations: { pocketId: string, amount: number }[] = []
  ) {
    this.logger.log(`[distributeSalary] Bắt đầu phân bổ ${totalAmount} cho user ${userId}`);

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPockets: any[] = [];
      let totalAllocated = 0;

      // ── B1: Phân bổ theo chỉ định từ Frontend (allocations) ───────────────
      if (allocations && allocations.length > 0) {
        for (const alloc of allocations) {
          if (!alloc.amount || alloc.amount <= 0) continue;
          
          const updated = await tx.pocket.update({
            where: { id: alloc.pocketId },
            data: { balance: { increment: alloc.amount } },
          });
          updatedPockets.push(updated);
          totalAllocated += alloc.amount;

          await tx.transaction.create({
            data: {
              userId,
              pocketId: alloc.pocketId,
              amount: alloc.amount,
              type: 'INCOME',
              title: `Phân bổ lương → ${updated.name}`,
              category: 'Salary',
            },
          });
        }
      }

      // ── B2: Tiền chưa phân bổ (Số dư lương còn lại) ───────────────────────
      const surplus = Math.max(0, totalAmount - totalAllocated);
      if (surplus > 0) {
        await tx.transaction.create({
          data: {
            userId,
            pocketId: null,
            amount: surplus,
            type: 'INCOME',
            title: `Lương chưa phân bổ (Tiền ngoài hũ)`,
            category: 'Salary',
          },
        });
      }

      // ── B3: Xử lý Chi phí cố định (Auto-Deduct từ Quỹ Tổng) ───────────────
      const fixedExpenses = await tx.fixedExpense.findMany({ where: { userId } });
      const totalFixed = fixedExpenses.filter(fe => fe.autoDeduct).reduce((sum, fe) => sum + Number(fe.amount), 0);

      for (const fe of fixedExpenses) {
        if (!fe.autoDeduct) continue;
        
        await tx.transaction.create({
          data: {
            userId,
            pocketId: null, // Trừ thẳng từ tổng tài sản (ngoài hũ)
            amount: Number(fe.amount),
            type: 'EXPENSE',
            title: `Tự động thanh toán phí cố định: ${fe.title}`,
            category: 'Utility',
          },
        });
      }

      // ── B4: Tính toán Unallocated Balance ròng ────────────────────────────
      // Tiền chưa phân bổ mới = Tiền dư từ phân bổ (surplus) - Tổng chi phí cố định
      const unallocatedChange = surplus - totalFixed;
      
      await (tx as any).user.update({
        where: { id: userId },
        data: { unallocatedBalance: { increment: unallocatedChange } },
      });

      return {
        success: true,
        message: 'Phân bổ lương thành công',
        breakdown: {
          totalSalary: totalAmount,
          fixedExpensesDeducted: totalFixed,
          allocated: totalAllocated,
          surplus,
          unallocatedChange,
        },
        updatedPockets,
      };
    });

    // Award 100 points
    const newlyUnlocked = await this.gamification.awardPoints(userId, 100, 'Phân bổ lương vào các hũ tài chính');
    return { ...result, newlyUnlocked };
  }
}
