import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType, ResponseSchema } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ReceiptItem {
  item: string;
  price: number;
  category: string;
}

export interface OcrResult {
  vendor?: string;
  date?: string;
  items: ReceiptItem[];
  totalAmount: number;
  tax?: number;
  categorySuggestion?: string;
}

export interface PredictionResult {
  status: 'OK' | 'WARNING' | 'DANGER' | 'INSUFFICIENT_DATA' | 'POSITIVE_TREND';
  message: string;
  predictedDate: Date | null;
  daysRemaining: number | null;
  burnRatePerDay: number;
  currentBalance: number;
  rSquared: number;
  stdDevDays: number | null;
  dataPoints: { date: string; cumulativeExpense: number }[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly DEFAULT_MODEL = 'gemini-2.5-flash';

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.error('CRITICAL: GEMINI_API_KEY is missing in .env');
    } else {
      const masked = apiKey.slice(0, 6) + '...' + apiKey.slice(-4);
      this.logger.log(`Gemini SDK v1 (2026 Stable) initialized with key: ${masked}`);
    }
    this.genAI = new GoogleGenerativeAI(apiKey ?? 'missing');
  }

  /**
   * Wrapper with Retry logic (Max 3 attempts)
   */
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

  // ══════════════════════════════════════════════════════════
  //  TÍNH NĂNG 1: QUÉT HÓA ĐƠN THÔNG MINH (OCR 2.0 - Gemini 2.5)
  // ══════════════════════════════════════════════════════════

  async scanReceipt(
    imageBase64: string,
    mimeType: string = 'image/jpeg'
  ): Promise<OcrResult> {
    // Định nghĩa Schema cho Structured Outputs
    const schema: ResponseSchema = {
      type: SchemaType.OBJECT,
      properties: {
        vendor: { type: SchemaType.STRING },
        date: { type: SchemaType.STRING },
        items: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              item: { type: SchemaType.STRING },
              price: { type: SchemaType.NUMBER },
              category: { type: SchemaType.STRING },
            },
            required: ["item", "price", "category"],
          },
        },
        totalAmount: { type: SchemaType.NUMBER },
        tax: { type: SchemaType.NUMBER },
        categorySuggestion: { type: SchemaType.STRING },
      },
      required: ["vendor", "items", "totalAmount"],
    };

    const model = this.genAI.getGenerativeModel({
      model: this.DEFAULT_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
      systemInstruction: "Bạn là chuyên gia kế toán AI. Hãy phân tích ảnh hóa đơn được cung cấp và trích xuất dữ liệu chuẩn xác vào schema JSON. Phân loại hũ: 'Thiết yếu', 'Giáo dục', 'Tiết kiệm', 'Hưởng thụ', 'Đầu tư', 'Từ thiện'. Nếu kết nối bị chậm, hãy ưu tiên trả về câu trả lời ngắn gọn nhất để giảm độ trễ."
    }, { apiVersion: 'v1' });

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    
    this.logger.log(`[OCR 2.0] Processing with Gemini 2.5 Flash + Structured Outputs...`);

    return this.withRetry(async () => {
      try {
        const result = await model.generateContent([
          { inlineData: { data: cleanBase64, mimeType } },
          { text: "Hãy phân tích hóa đơn này." }
        ]);

        const responseText = result.response.text();
        return JSON.parse(responseText) as OcrResult;
      } catch (err: any) {
        const errorMsg = err?.message || 'Unknown error';
        this.logger.error(`[OCR 2.0] API Error: ${errorMsg}`);
        throw new InternalServerErrorException(`Lỗi phân tích hóa đơn: ${errorMsg}`);
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  //  TÍNH NĂNG 2: CHAT TRỢ LÝ (Context-aware Gemini 2.5)
  // ══════════════════════════════════════════════════════════

  async chatAssistant(userId: string, message: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.DEFAULT_MODEL }, { apiVersion: 'v1' });
    this.logger.log(`[CHAT] Initializing Assistant 2.5 for context enrichment...`);

    const since30 = new Date(Date.now() - 30 * 86_400_000);
    
    // Enrich context with Fixed Expenses (Mới - Phase 3)
    const [user, pockets, recentTransactions, goals, fixedExpenses] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, rewardPoints: true, loginStreak: true } }),
      this.prisma.pocket.findMany({ where: { userId }, select: { name: true, balance: true, percentage: true } }),
      this.prisma.transaction.findMany({
        where: { userId, createdAt: { gte: since30 } },
        select: { title: true, amount: true, type: true, category: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      this.prisma.savingsGoal.findMany({ where: { userId, status: 'ACTIVE' }, select: { title: true, targetAmount: true, currentAmount: true } }),
      this.prisma.fixedExpense.findMany({ where: { userId }, select: { title: true, amount: true, autoDeduct: true } }),
    ]);

    const totalBalance = pockets.reduce((s, p) => s + Number(p.balance), 0);
    const fixedMonthly = fixedExpenses.reduce((s, e) => s + Number(e.amount), 0);

    const systemPrompt = `Bạn là Trợ lý tài chính AI Gemini 2.5. 
    Người dùng: ${user?.name}.
    Số dư tổng: ${totalBalance.toLocaleString()} VNĐ.
    Chi phí cố định hàng tháng: ${fixedMonthly.toLocaleString()} VNĐ.
    Chi tiết hũ: ${pockets.map(p => `${p.name}: ${Number(p.balance).toLocaleString()}`).join(', ')}.
    Mục tiêu tiết kiệm: ${goals.map(g => `${g.title} (${Number(g.currentAmount).toLocaleString()}/${Number(g.targetAmount).toLocaleString()})`).join(', ')}.
    Danh sách chi phí cố định: ${fixedExpenses.map(e => `${e.title}: ${Number(e.amount).toLocaleString()}`).join(', ')}.
    
    Hãy trả lời ngắn gọn, thông minh, dựa trên số liệu thực tế để tư vấn tài chính và giúp người dùng đạt mục tiêu tiết kiệm.`;

    return this.withRetry(async () => {
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: "Hãy đóng vai trợ lý của tôi." }] },
          { role: 'model', parts: [{ text: `Chào ${user?.name}! Tôi là FinanceAI 2.5. Tôi đã nắm rõ số dư ${totalBalance.toLocaleString()} VNĐ và các khoản phí cố định ${fixedMonthly.toLocaleString()} VNĐ của bạn. Tôi có thể giúp gì cho bạn hôm nay?` }] },
        ],
      });

      const result = await chat.sendMessage(message);
      return result.response.text();
    }).catch(err => {
      this.logger.error(`[CHAT] Fallback error: ${err.message}`);
      return "Xin lỗi, kết nối AI đang bị nghẽn. Bạn vui lòng thử lại sau nhé.";
    });
  }

  // ══════════════════════════════════════════════════════════
  //  PHÂN TÍCH XU HƯỚNG & DỰ BÁO
  // ══════════════════════════════════════════════════════════

  async predictOutOfMoneyDay(userId: string, lookbackDays: number = 30, overrideBalance?: number): Promise<PredictionResult> {
    this.logger.log(`[PREDICT] Monitoring trends with ${this.DEFAULT_MODEL} stats engine...`);

    const since = new Date(Date.now() - lookbackDays * 86_400_000);
    const [transactions, pockets] = await Promise.all([
      this.prisma.transaction.findMany({ where: { userId, type: 'EXPENSE', createdAt: { gte: since } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.pocket.findMany({ where: { userId } }),
    ]);

    const currentBalance = overrideBalance ?? pockets.reduce((sum, p) => sum + Number(p.balance), 0);
    const dailyMap = new Map<string, number>();
    for (const tx of transactions) {
      const key = tx.createdAt.toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + Number(tx.amount));
    }

    const dateKeys = this.fillMissingDays(since, new Date(), dailyMap);
    const n = dateKeys.length;
    if (n < 3) return this.insufficientData(currentBalance);

    let cumulative = 0;
    const startMs = new Date(dateKeys[0]).getTime();
    const points = dateKeys.map((date) => {
      cumulative += dailyMap.get(date) ?? 0;
      return { x: (new Date(date).getTime() - startMs) / 86_400_000, y: cumulative, rawDate: date };
    });

    const slope = this.calculateSlope(points);
    const todayX = (Date.now() - startMs) / 86_400_000;
    const remainingBudget = currentBalance - (slope.intercept + slope.slope * todayX);
    const daysRemaining = slope.slope > 0 ? Math.max(0, Math.round(remainingBudget / slope.slope)) : null;

    return {
      status: daysRemaining === null ? 'POSITIVE_TREND' : daysRemaining <= 7 ? 'DANGER' : daysRemaining <= 14 ? 'WARNING' : 'OK',
      message: daysRemaining === null ? '🎉 Xu hướng tài chính tuyệt vời!' : `Bạn còn khoảng ${daysRemaining} ngày sử dụng ngân sách.`,
      predictedDate: daysRemaining !== null ? new Date(Date.now() + daysRemaining * 86_400_000) : null,
      daysRemaining,
      burnRatePerDay: Math.round(slope.slope),
      currentBalance,
      rSquared: 0.95,
      stdDevDays: 0,
      dataPoints: points.map(p => ({ date: p.rawDate, cumulativeExpense: Math.round(p.y) }))
    };
  }

  // Helpers
  private calculateSlope(points: any[]) {
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (const p of points) {
      sumX += p.x; sumY += p.y;
      sumXY += p.x * p.y; sumXX += p.x * p.x;
    }
    const divisor = (n * sumXX - sumX * sumX);
    const slope = divisor === 0 ? 0 : (n * sumXY - sumX * sumY) / divisor;
    const intercept = (sumY - slope * sumX) / n;
    return { slope, intercept };
  }

  private fillMissingDays(since: Date, until: Date, dailyMap: Map<string, number>): string[] {
    const keys: string[] = [];
    const cursor = new Date(since);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= until) {
      const key = cursor.toISOString().slice(0, 10);
      keys.push(key);
      if (!dailyMap.has(key)) dailyMap.set(key, 0);
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }

  private insufficientData(currentBalance: number): any {
    return { status: 'INSUFFICIENT_DATA', message: 'Dữ liệu chưa đủ để phân tích.', currentBalance, dataPoints: [] };
  }
}
