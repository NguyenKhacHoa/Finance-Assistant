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

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE PRIVATE: distributeIncomeToPockets
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Tính toán chính xác số tiền phân bổ vào từng hũ theo tỷ lệ phần trăm.
   *
   * ⚠️  Vấn đề cần giải quyết: Floating-point rounding errors
   * ──────────────────────────────────────────────────────────
   * Ví dụ nguy hiểm: totalAmount = 10,000,000 với 3 hũ (33.33%, 33.33%, 33.34%)
   *   Naive (Math.round):
   *     Hũ A = Math.round(10,000,000 * 0.3333) = 3,333,000
   *     Hũ B = Math.round(10,000,000 * 0.3333) = 3,333,000
   *     Hũ C = Math.round(10,000,000 * 0.3334) = 3,334,000
   *     Total = 10,000,000  ← Tình cờ đúng, nhưng không đảm bảo mọi trường hợp
   *
   * Thuật toán: Largest Remainder Method (Hamilton Method) — Chuẩn kế toán
   * ────────────────────────────────────────────────────────────────────────
   *   1. Tính exact share cho từng hũ: exact_i = totalAmount * (pct_i / 100)
   *   2. Lấy floor của từng exact_i → floor_i (phần nguyên an toàn)
   *   3. Xác định số đơn vị dư: remainingUnits = totalAmount - SUM(floor_i)
   *   4. Sắp xếp hũ theo phần thập phân giảm dần
   *   5. Cộng thêm 1 đơn vị (1 VNĐ) lần lượt cho các hũ đứng đầu
   *   → Đảm bảo: SUM(allocatedAmount_i) === totalAmount (tuyệt đối)
   *
   * @param totalAmount  Tổng số tiền (VNĐ, phải là số nguyên dương)
   * @param pockets      Mảng { id, name, percentage } — percentage: 0–100
   * @returns            Mảng { pocketId, name, percentage, allocatedAmount }
   *                     đảm bảo SUM(allocatedAmount) === totalAmount
   */
  private distributeIncomeToPockets(
    totalAmount: number,
    pockets: { id: string; name: string; percentage: number }[],
  ): { pocketId: string; name: string; percentage: number; allocatedAmount: number }[] {
    // ── Bước 0: Validate ──────────────────────────────────────────────────
    if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
      throw new BadRequestException(
        `Số tiền không hợp lệ: ${totalAmount}. Phải là số nguyên dương (VNĐ).`,
      );
    }
    if (pockets.length === 0) {
      throw new BadRequestException('Không có hũ nào được cấu hình để phân bổ.');
    }

    // ── Bước 1: Normalize % nếu tổng ≠ 100 ───────────────────────────────
    const totalPercentage = pockets.reduce((sum, p) => sum + p.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      this.logger.warn(
        `[distributeIncomeToPockets] Tổng % = ${totalPercentage} ≠ 100. Normalize để phân bổ toàn bộ ${totalAmount}.`,
      );
    }
    // normFactor đảm bảo dù tổng % là bao nhiêu, ta vẫn phân bổ đúng 100% totalAmount
    const normFactor = totalPercentage > 0 ? 100 / totalPercentage : 1;

    // ── Bước 2: Tính exact share ─────────────────────────────────────────
    const exactAmounts = pockets.map((p) => ({
      pocketId: p.id,
      name: p.name,
      percentage: p.percentage,
      exactAmount: totalAmount * ((p.percentage * normFactor) / 100),
    }));

    // ── Bước 3: Floor → phần nguyên ──────────────────────────────────────
    const floored = exactAmounts.map((item) => ({
      ...item,
      allocatedAmount: Math.floor(item.exactAmount),
      // Phần thập phân quyết định ai được nhận 1 đồng dư
      remainder: item.exactAmount - Math.floor(item.exactAmount),
    }));

    // ── Bước 4: Largest Remainder Method ─────────────────────────────────
    const totalFloored = floored.reduce((sum, item) => sum + item.allocatedAmount, 0);
    const remainingUnits = totalAmount - totalFloored; // số đồng dư cần phân phối

    // Sắp xếp: remainder lớn nhất nhận thêm 1 đồng trước
    const sorted = [...floored].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remainingUnits; i++) {
      sorted[i % sorted.length].allocatedAmount += 1;
    }

    // ── Bước 5: Assertion bảo vệ – không bao giờ được sai ────────────────
    const finalTotal = sorted.reduce((sum, item) => sum + item.allocatedAmount, 0);
    if (finalTotal !== totalAmount) {
      throw new Error(
        `[FATAL] Lỗi kế toán: Tổng phân bổ ${finalTotal} ≠ ${totalAmount}. ` +
        `Báo cáo ngay cho kỹ thuật để kiểm tra.`,
      );
    }

    this.logger.log(
      `[distributeIncomeToPockets] ${totalAmount.toLocaleString()} VNĐ → ` +
      sorted.map((s) => `${s.name}: ${s.allocatedAmount.toLocaleString()} (${s.percentage}%)`).join(' | '),
    );

    // Trả về theo thứ tự input gốc để output nhất quán
    const resultMap = new Map(sorted.map((s) => [s.pocketId, s]));
    return pockets.map((p) => resultMap.get(p.id)!);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC: distributeSalary
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Phân bổ lương vào các hũ theo quy trình chuẩn kế toán.
   *
   * ⚡ Bảo mật quan trọng:
   *   - `allocations` từ client CHỈ dùng để xác định pocketId nào tham gia.
   *   - Trường `amount` từ client bị BỎ QUA hoàn toàn.
   *   - Mọi amount đều được tính lại server-side từ `percentage` trong DB.
   *   → Đây là fix cho bug: client gửi amount = totalAmount cho hũ 50%.
   *
   * Quy trình:
   *   B1. Lấy hũ từ DB (source of truth cho percentage)
   *   B2. Gọi distributeIncomeToPockets() → amount chính xác từng hũ
   *   B3. Atomic transaction: cập nhật balance + tạo transaction records
   *   B4. Surplus (% tổng < 100%) → unallocatedBalance
   *   B5. Chi phí cố định autoDeduct → EXPENSE transaction
   */
  async distributeSalary(
    userId: string,
    totalAmount: number,
    allocations: { pocketId: string; amount: number }[] = [],
  ) {
    // ── Validate & normalize totalAmount ─────────────────────────────────
    const safeTotal = Math.round(totalAmount);
    if (safeTotal <= 0) {
      throw new BadRequestException('Số tiền lương phải lớn hơn 0 VNĐ.');
    }
    this.logger.log(`[distributeSalary] Bắt đầu phân bổ ${safeTotal.toLocaleString()} VNĐ cho user ${userId}`);

    // ── Lấy hũ từ DB (source of truth) ───────────────────────────────────
    const allPockets = await this.prisma.pocket.findMany({
      where: { userId },
      select: { id: true, name: true, percentage: true },
    });
    if (allPockets.length === 0) {
      throw new BadRequestException('Bạn chưa thiết lập hũ tài chính.');
    }

    // ── Xác định hũ tham gia phân bổ ─────────────────────────────────────
    // Nếu client gửi allocations → chỉ phân bổ vào các pocketId đó
    // Nếu không → phân bổ toàn bộ hũ của user
    let targetPockets: { id: string; name: string; percentage: number }[];

    if (allocations && allocations.length > 0) {
      const requestedIds = new Set(allocations.map((a) => a.pocketId));
      targetPockets = allPockets
        .filter((p) => requestedIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, percentage: Number(p.percentage) }));

      if (targetPockets.length === 0) {
        throw new BadRequestException('Không tìm thấy hũ hợp lệ trong danh sách phân bổ.');
      }
    } else {
      targetPockets = allPockets.map((p) => ({
        id: p.id,
        name: p.name,
        percentage: Number(p.percentage),
      }));
    }

    // ── Tính phân bổ chính xác (Largest Remainder Method) ─────────────────
    const distributions = this.distributeIncomeToPockets(safeTotal, targetPockets);

    // ── Atomic Prisma Transaction ──────────────────────────────────────────
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPockets: any[] = [];
      let totalAllocated = 0;
      const txTimestamp = new Date(); // timestamp thống nhất cho cả batch

      // ── B1: Nạp tiền vào từng hũ ───────────────────────────────────────
      for (const dist of distributions) {
        if (dist.allocatedAmount <= 0) continue; // bỏ qua hũ 0%

        const updated = await tx.pocket.update({
          where: { id: dist.pocketId },
          data: { balance: { increment: dist.allocatedAmount } },
        });
        updatedPockets.push(updated);
        totalAllocated += dist.allocatedAmount;

        await tx.transaction.create({
          data: {
            userId,
            pocketId: dist.pocketId,
            amount: dist.allocatedAmount,
            type: 'INCOME',
            title: `Phân bổ lương → ${dist.name} (${dist.percentage}%)`,
            category: 'Salary',
            createdAt: txTimestamp,
            metadata: {
              source: 'salary_distribution',
              originalTotal: safeTotal,
              percentage: dist.percentage,
              allocatedAmount: dist.allocatedAmount,
            },
          },
        });
      }

      // ── B2: Surplus → unallocatedBalance (khi tổng % < 100%) ──────────
      const surplus = Math.max(0, safeTotal - totalAllocated);
      const targetTotal = targetPockets.reduce((s, p) => s + p.percentage, 0);
      if (surplus > 0) {
        this.logger.log(`[distributeSalary] Surplus: ${surplus.toLocaleString()} VNĐ → unallocatedBalance`);
        await tx.transaction.create({
          data: {
            userId,
            pocketId: null,
            amount: surplus,
            type: 'INCOME',
            title: `Lương chưa phân bổ (${(100 - targetTotal).toFixed(2)}% còn lại)`,
            category: 'Salary',
            createdAt: txTimestamp,
            metadata: { source: 'salary_surplus', surplusAmount: surplus },
          },
        });
      }

      // ── B3: Auto-Deduct chi phí cố định ───────────────────────────────
      const fixedExpenses = await tx.fixedExpense.findMany({ where: { userId } });
      const totalFixed = fixedExpenses
        .filter((fe) => fe.autoDeduct)
        .reduce((sum, fe) => sum + Number(fe.amount), 0);

      for (const fe of fixedExpenses) {
        if (!fe.autoDeduct) continue;
        await tx.transaction.create({
          data: {
            userId,
            pocketId: null,
            amount: Number(fe.amount),
            type: 'EXPENSE',
            title: `Tự động thanh toán phí cố định: ${fe.title}`,
            category: 'Utility',
            createdAt: txTimestamp,
          },
        });
      }

      // ── B4: Cập nhật unallocatedBalance ròng ──────────────────────────
      const unallocatedChange = surplus - totalFixed;
      await (tx as any).user.update({
        where: { id: userId },
        data: { unallocatedBalance: { increment: unallocatedChange } },
      });

      return {
        success: true,
        message: 'Phân bổ lương thành công',
        timestamp: txTimestamp.toISOString(),
        breakdown: {
          totalSalary: safeTotal,
          totalAllocated,
          surplus,
          fixedExpensesDeducted: totalFixed,
          unallocatedChange,
          distributions: distributions.map((d) => ({
            pocketId: d.pocketId,
            name: d.name,
            percentage: d.percentage,
            allocatedAmount: d.allocatedAmount,
          })),
        },
        updatedPockets,
      };
    });

    // ── Gamification ───────────────────────────────────────────────────────
    const newlyUnlocked = await this.gamification.awardPoints(
      userId, 100, 'Phân bổ lương vào các hũ tài chính',
    );

    return { ...result, newlyUnlocked };
  }
}
