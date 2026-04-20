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
  // CORE PRIVATE: calculateMaxCapacity
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Tính sức chứa tối đa của một hũ theo công thức:
   *   Max_Balance = (Total_Pockets_Balance + unallocatedBalance) × (pocketPercentage / 100)
   *
   * @param totalPocketsBalance  Tổng balance của TẤT CẢ hũ thường (không tính 'Tiền chưa vào hũ')
   * @param unallocatedBalance   Tổng số dư chưa phân bổ (pocket + user.unallocatedBalance)
   * @param pocketPercentage     Tỷ lệ % của hũ cần tính
   * @returns                    Số dư tối đa được phép của hũ
   */
  private calculateMaxCapacity(
    totalPocketsBalance: number,
    unallocatedBalance: number,
    pocketPercentage: number,
  ): number {
    const total = totalPocketsBalance + unallocatedBalance;
    return total * (pocketPercentage / 100);
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
  ) {
    const safeTotal = Math.round(totalAmount);
    // Tính tổng phần trăm mục tiêu
    const targetTotalPercentage = pockets.reduce((acc, p) => acc + p.percentage, 0);

    // Tính exact amount cho mỗi hũ mà KHÔNG DÙNG normFactor
    // Lượng tiền allocate cho các hũ = safeTotal * (targetTotalPercentage / 100)
    // Nhưng ta sẽ gán cho mỗi hũ = safeTotal * (p.percentage / 100)
    const exactAmounts = pockets.map((p) => ({
      pocketId: p.id,
      name: p.name,
      percentage: p.percentage,
      exactAmount: safeTotal * (p.percentage / 100),
    }));

    const floored = exactAmounts.map((item) => ({
      ...item,
      allocatedAmount: Math.floor(item.exactAmount),
      remainder: item.exactAmount - Math.floor(item.exactAmount),
    }));

    // Số tổng cần phân bổ bằng LRM cho phần mục tiêu
    // Target Total Amount = SUM(exactAmount) -> làm tròn
    const totalTargetAmount = Math.round(exactAmounts.reduce((s, a) => s + a.exactAmount, 0));
    const totalFloored = floored.reduce((sum, item) => sum + item.allocatedAmount, 0);

    const remainingUnits = totalTargetAmount - totalFloored;
    
    const sorted = [...floored].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remainingUnits; i++) {
        if (sorted.length > 0) {
            sorted[i % sorted.length].allocatedAmount += 1;
        }
    }

    const finalTotal = sorted.reduce((sum, item) => sum + item.allocatedAmount, 0);
    if (finalTotal !== totalTargetAmount) {
      throw new Error(
        `[FATAL] Lỗi kế toán: Tổng phân bổ hũ thật ${finalTotal} ≠ ${totalTargetAmount}.`,
      );
    }

    this.logger.log(
      `[distributeIncomeToPockets] Target ${totalTargetAmount.toLocaleString()} VNĐ → ` +
      sorted.map((s) => `${s.name}: ${s.allocatedAmount.toLocaleString()} (${s.percentage}%)`).join(' | '),
    );

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
    let targetPockets: { id: string; name: string; percentage: number }[];

    if (allocations && allocations.length > 0) {
      const requestedIds = new Set(allocations.map((a) => a.pocketId));
      targetPockets = allPockets
        .filter((p) => requestedIds.has(p.id) && p.name !== 'Tiền chưa vào hũ')
        .map((p) => ({ id: p.id, name: p.name, percentage: Number(p.percentage) }));
    } else {
      targetPockets = allPockets
        .filter(p => p.name !== 'Tiền chưa vào hũ')
        .map((p) => ({
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

      // 0. Tính tổng tài sản hiện tại (TRƯỚC khi nạp lương) để làm baseline Max Capacity
      const allPocketsTx = await (tx as any).pocket.findMany({ where: { userId } });
      const userRecordTx = await (tx as any).user.findUnique({ where: { id: userId } });
      const pocketTotalBalance = allPocketsTx
        .filter((p: any) => p.name !== 'Tiền chưa vào hũ')
        .reduce((sum: number, p: any) => sum + Number(p.balance), 0);
      const unallocatedTotal =
        Number(allPocketsTx.find((p: any) => p.name === 'Tiền chưa vào hũ')?.balance || 0) +
        Number(userRecordTx?.unallocatedBalance || 0);
      // Tổng tài sản bao gồm cả lương sắp nạp vào
      const totalAssets = pocketTotalBalance + unallocatedTotal + safeTotal;

      // ── B1: Nạp tiền vào từng hũ (soft-cap: nạp đến tối đa, thừa → unallocated) ─
      for (const dist of distributions) {
        if (dist.allocatedAmount <= 0) continue; // bỏ qua hũ 0%

        const pocket = allPocketsTx.find((p: any) => p.id === dist.pocketId);
        if (!pocket) continue;

        // Sử dụng calculateMaxCapacity với totalAssets đã bao gồm lương
        const maxCapacity = this.calculateMaxCapacity(
          totalAssets - unallocatedTotal,  // phần pocket trong totalAssets
          unallocatedTotal,                 // phần unallocated trong totalAssets
          Number(pocket.percentage),
        );
        let actualAmountToFund = dist.allocatedAmount;
        const projectedBalance = Number(pocket.balance) + actualAmountToFund;

        if (projectedBalance > maxCapacity) {
          // Soft overflow: chỉ nạp đến mức tối đa, phần thừa dồn về unallocated
          actualAmountToFund = Math.max(0, Math.floor(maxCapacity - Number(pocket.balance)));
          this.logger.log(
            `[distributeSalary] Hũ "${dist.name}" đầy (max: ${maxCapacity.toLocaleString()} VNĐ). ` +
            `Nạp: ${actualAmountToFund.toLocaleString()} VNĐ, thừa: ${(dist.allocatedAmount - actualAmountToFund).toLocaleString()} VNĐ → unallocated`,
          );
        }

        if (actualAmountToFund > 0) {
          const updated = await (tx as any).pocket.update({
            where: { id: dist.pocketId },
            data: { balance: { increment: actualAmountToFund } },
          });
          updatedPockets.push(updated);
          totalAllocated += actualAmountToFund;

          await (tx as any).transaction.create({
            data: {
              userId,
              pocketId: dist.pocketId,
              amount: actualAmountToFund,
              type: 'INCOME',
              title: `Phân bổ lương → ${dist.name} (${dist.percentage}%)`,
              category: 'Salary',
              createdAt: txTimestamp,
              metadata: {
                source: 'salary_distribution',
                originalTotal: safeTotal,
                percentage: dist.percentage,
                allocatedAmount: actualAmountToFund,
              },
            },
          });
        }
      }

      // ── B2: Surplus (% < 100% HOẶC hũ đầy theo giới hạn) → unallocated ──
      const surplus = Math.max(0, safeTotal - totalAllocated);
      const targetTotal = targetPockets.reduce((s, p) => s + p.percentage, 0);
      if (surplus > 0) {
        this.logger.log(`[distributeSalary] Surplus: ${surplus.toLocaleString()} VNĐ → Tiền chưa vào hũ`);
        
        let unallocatedPocket = await tx.pocket.findFirst({
            where: { userId, name: 'Tiền chưa vào hũ' }
        });

        if (!unallocatedPocket) {
            unallocatedPocket = await tx.pocket.create({
                data: {
                    userId,
                    name: 'Tiền chưa vào hũ',
                    percentage: 0,
                    balance: surplus,
                    isEssential: false,
                }
            });
            updatedPockets.push(unallocatedPocket);
        } else {
            const updated = await tx.pocket.update({
                where: { id: unallocatedPocket.id },
                data: { balance: { increment: surplus } }
            });
            updatedPockets.push(updated);
        }

        await tx.transaction.create({
          data: {
            userId,
            pocketId: unallocatedPocket.id,
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
      // Surplus đã được chuyển vào hũ "Tiền chưa vào hũ", nên không cộng vào unallocatedBalance nữa.
      // Dùng unallocatedBalance để trả chi phí cố định.
      const unallocatedChange = -totalFixed;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC: depositToUnallocated
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Bước 1 của luồng nạp tiền mới:
   * Ghi nhận số tiền vào mục "Tiền chưa vào hũ" (Chưa phân bổ).
   * Không phân bổ ngay — người dùng quyết định sau.
   */
  async depositToUnallocated(userId: string, amount: number, note?: string) {
    const safeAmount = Math.round(amount);
    if (safeAmount <= 0) throw new BadRequestException('Số tiền phải lớn hơn 0 VNĐ.');

    const txTimestamp = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // Tìm hoặc tạo pocket "Tiền chưa vào hũ"
      let unallocatedPocket = await (tx as any).pocket.findFirst({
        where: { userId, name: 'Tiền chưa vào hũ' },
      });

      if (!unallocatedPocket) {
        unallocatedPocket = await (tx as any).pocket.create({
          data: {
            userId,
            name: 'Tiền chưa vào hũ',
            percentage: 0,
            balance: 0,
            isEssential: false,
          },
        });
      }

      // Cộng tiền vào unallocated pocket
      const updatedPocket = await (tx as any).pocket.update({
        where: { id: unallocatedPocket.id },
        data: { balance: { increment: safeAmount } },
      });

      // Tạo transaction record
      const transaction = await (tx as any).transaction.create({
        data: {
          userId,
          pocketId: unallocatedPocket.id,
          amount: safeAmount,
          type: 'INCOME',
          title: note || `Nạp tiền vào tài khoản`,
          category: 'Other',
          createdAt: txTimestamp,
          metadata: { source: 'direct_deposit', depositedAt: txTimestamp.toISOString() },
        },
      });

      return {
        success: true,
        message: 'Đã nạp tiền thành công vào mục Chưa phân bổ',
        depositedAmount: safeAmount,
        unallocatedPocketId: unallocatedPocket.id,
        updatedBalance: Number(updatedPocket.balance),
        transactionId: transaction.id,
        timestamp: txTimestamp.toISOString(),
      };
    });

    // Gamification: thưởng điểm khi nạp tiền
    await this.gamification.awardPoints(userId, 20, 'Nạp tiền vào tài khoản');

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC: distributeFromUnallocated
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Bước 2 (tùy chọn) của luồng nạp tiền:
   * Phân bổ tiền từ "Tiền chưa vào hũ" vào các hũ được chỉ định.
   * Kiểm tra số dư "Chưa phân bổ" đủ trước khi thực hiện.
   *
   * @param allocations  Danh sách { pocketId, amount } — tổng amount ≤ unallocated balance
   * @param mode         'manual' = người dùng tự chia | 'ai' = AI gợi ý dựa trên % default
   */
  async distributeFromUnallocated(
    userId: string,
    allocations: { pocketId: string; amount: number }[],
  ) {
    if (!allocations || allocations.length === 0) {
      throw new BadRequestException('Danh sách phân bổ không được rỗng.');
    }

    const totalToDistribute = allocations.reduce((s, a) => s + Math.round(a.amount), 0);
    if (totalToDistribute <= 0) throw new BadRequestException('Tổng số tiền phân bổ phải lớn hơn 0.');

    // Kiểm tra balance của "Tiền chưa vào hũ"
    const unallocatedPocket = await this.prisma.pocket.findFirst({
      where: { userId, name: 'Tiền chưa vào hũ' },
    });
    const userRecord = await this.prisma.user.findUnique({ where: { id: userId } });

    const totalUnallocated =
      Number(unallocatedPocket?.balance || 0) + Number(userRecord?.unallocatedBalance || 0);

    if (totalToDistribute > totalUnallocated) {
      throw new BadRequestException(
        `Không đủ số dư chưa phân bổ. Hiện có: ${totalUnallocated.toLocaleString()} VNĐ, ` +
        `cần: ${totalToDistribute.toLocaleString()} VNĐ.`,
      );
    }

    // Validate all target pockets belong to user
    const targetPocketIds = allocations.map((a) => a.pocketId);
    const targetPockets = await this.prisma.pocket.findMany({
      where: { id: { in: targetPocketIds }, userId },
      select: { id: true, name: true },
    });
    if (targetPockets.length !== targetPocketIds.length) {
      throw new BadRequestException('Một hoặc nhiều hũ không tồn tại hoặc không thuộc về bạn.');
    }

    const pocketNameMap = Object.fromEntries(targetPockets.map((p) => [p.id, p.name]));
    const txTimestamp = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      let remainingToDeduct = totalToDistribute;
      const updatedPockets: any[] = [];

      // Trừ từ pocket "Tiền chưa vào hũ" trước
      if (unallocatedPocket && Number(unallocatedPocket.balance) > 0) {
        const deductFromPocket = Math.min(Number(unallocatedPocket.balance), remainingToDeduct);
        const updated = await (tx as any).pocket.update({
          where: { id: unallocatedPocket.id },
          data: { balance: { decrement: deductFromPocket } },
        });
        updatedPockets.push(updated);
        remainingToDeduct -= deductFromPocket;
      }

      // Nếu còn thiếu, trừ từ user.unallocatedBalance
      if (remainingToDeduct > 0) {
        await (tx as any).user.update({
          where: { id: userId },
          data: { unallocatedBalance: { decrement: remainingToDeduct } },
        });
      }

      // Tính tổng tài sản SAU KHI đã trừ khỏi unallocated (snapshot mới nhất trong transaction)
      const allPocketsTx = await (tx as any).pocket.findMany({ where: { userId } });
      const userRecordTx = await (tx as any).user.findUnique({ where: { id: userId } });
      const pocketTotalBalance = allPocketsTx
        .filter((p: any) => p.name !== 'Tiền chưa vào hũ')
        .reduce((sum: number, p: any) => sum + Number(p.balance), 0);
      const unallocatedTotalTx =
        Number(allPocketsTx.find((p: any) => p.name === 'Tiền chưa vào hũ')?.balance || 0) +
        Number(userRecordTx?.unallocatedBalance || 0);
      const totalAssets = pocketTotalBalance + unallocatedTotalTx;

      // Cộng tiền vào từng hũ đích + ghi transaction
      for (const alloc of allocations) {
        const safeAmt = Math.round(alloc.amount);
        if (safeAmt <= 0) continue;

        const pocket = allPocketsTx.find((p: any) => p.id === alloc.pocketId);
        if (!pocket) continue;

        // Hard-cap: dùng calculateMaxCapacity với snapshot hiện tại trong transaction
        const maxCapacity = this.calculateMaxCapacity(
          pocketTotalBalance,
          unallocatedTotalTx,
          Number(pocket.percentage),
        );
        const projectedBalance = Number(pocket.balance) + safeAmt;

        if (projectedBalance > maxCapacity) {
          throw new BadRequestException(
            `Hũ [${pocket.name}] đã đầy theo tỷ lệ ${pocket.percentage}%. ` +
            `Hãy tăng tỷ lệ % để nạp thêm.`,
          );
        }

        const updated = await (tx as any).pocket.update({
          where: { id: alloc.pocketId },
          data: { balance: { increment: safeAmt } },
        });
        updatedPockets.push(updated);

        await (tx as any).transaction.create({
          data: {
            userId,
            pocketId: alloc.pocketId,
            amount: safeAmt,
            type: 'TRANSFER',
            source: 'SYSTEM',
            title: `Phân bổ vào hũ: ${pocketNameMap[alloc.pocketId]}`,
            category: 'Other',
            createdAt: txTimestamp,
            metadata: {
              source: 'distribute_from_unallocated',
              distributedAt: txTimestamp.toISOString(),
            },
          },
        });
      }

      return {
        success: true,
        message: 'Phân bổ tiền vào các hũ thành công',
        totalDistributed: totalToDistribute,
        allocations: allocations.map((a) => ({
          pocketId: a.pocketId,
          name: pocketNameMap[a.pocketId],
          amount: Math.round(a.amount),
        })),
        updatedPockets,
        timestamp: txTimestamp.toISOString(),
      };
    });

    // Gamification
    const newlyUnlocked = await this.gamification.awardPoints(
      userId, 50, 'Phân bổ tiền vào các hũ tài chính',
    );

    return { ...result, newlyUnlocked };
  }
}
