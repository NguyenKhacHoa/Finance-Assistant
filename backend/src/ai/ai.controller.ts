import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  BadRequestException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Logger,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { JwtGuard } from '../auth/jwt.guard';
import { OcrReceiptDto } from './dto/ocr.dto';
import { PredictBrokeDayDto } from './dto/predict.dto';
import { AnalyzeFinanceDto } from './dto/analyze.dto';


// ─────────────────────────────────────────────
// Helper: convert multipart file buffer → Base64
// ─────────────────────────────────────────────
function bufferToBase64(buffer: Buffer): string {
  return buffer.toString('base64');
}

// ─────────────────────────────────────────────

@UseGuards(JwtGuard)
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(private readonly aiService: AiService) {}

  // ══════════════════════════════════════════════════════════
  //  POST /ai/ocr  (JSON body – imageBase64)
  // ══════════════════════════════════════════════════════════
  /**
   * Upload hóa đơn dưới dạng chuỗi Base64. Phù hợp khi FE đã mã hóa ảnh.
   *
   * Body:
   * {
   *   "imageBase64": "<base64 string hoặc data URI>",
   *   "mimeType": "image/jpeg"   // optional, mặc định image/jpeg
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "data": {
   *     "items": [{ "item": "...", "price": 50000, "category": "Food" }],
   *     "totalAmount": 150000,
   *     "itemCount": 3
   *   }
   * }
   */
  @Post('ocr')
  async ocrBase64(@Body() body: OcrReceiptDto, @Req() req: any) {
    if (!body.imageBase64) {
      throw new BadRequestException(
        'Thiếu trường imageBase64. Truyền chuỗi Base64 hoặc data URI của ảnh hóa đơn.',
      );
    }
    this.logger.log(`[OCR/base64] userId=${req.user?.sub}`);
    const result = await this.aiService.scanReceipt(
      body.imageBase64,
      body.mimeType ?? 'image/jpeg',
    );

    return {
      success: true,
      data: result,
    };
  }

  // ══════════════════════════════════════════════════════════
  //  POST /ai/ocr/upload  (multipart/form-data – file)
  // ══════════════════════════════════════════════════════════
  /**
   * Upload file ảnh trực tiếp (multipart/form-data). Phù hợp khi FE dùng <input type="file">.
   *
   * Form field: "file" (binary image, max 10MB, JPEG/PNG/WebP)
   *
   * Response: Như /ai/ocr ở trên.
   */
  @Post('ocr/upload')
  @UseInterceptors(FileInterceptor('file'))
  async ocrUpload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: any,
    @Req() req: any,
  ) {
    this.logger.log(
      `[OCR/upload] userId=${req.user?.sub} | originalname=${file?.originalname} | size=${file?.size}`,
    );
    const base64 = bufferToBase64(file.buffer);
    const result = await this.aiService.scanReceipt(base64, file.mimetype);

    return {
      success: true,
      data: result,
    };
  }

  // ══════════════════════════════════════════════════════════
  //  POST /ai/scan-receipt (OCR 2.0 - Multimodal Gemini 2.5)
  // ══════════════════════════════════════════════════════════
  /**
   * Phân tích hóa đơn nâng cao với Gemini 2.5 Flash.
   * Hỗ trợ Base64 hoặc File upload.
   */
  @Post('scan-receipt')
  @UseInterceptors(FileInterceptor('file'))
  async scanReceipt(
    @UploadedFile() file: any,
    @Body() body: any,
    @Req() req: any
  ) {
    const userId = req.user?.sub;
    let base64 = body.imageBase64;
    let mimeType = body.mimeType || 'image/jpeg';

    if (file) {
      base64 = bufferToBase64(file.buffer);
      mimeType = file.mimetype;
    }

    if (!base64) {
      throw new BadRequestException('Thiếu dữ liệu hình ảnh (file hoặc base64).');
    }

    this.logger.log(`[SCAN-RECEIPT] userId=${userId} | Processing with Gemini 2.5 Flash...`);
    const result = await this.aiService.scanReceipt(base64, mimeType);

    return {
      success: true,
      data: result
    };
  }

  // ══════════════════════════════════════════════════════════
  //  GET /ai/predict-broke-day
  // ══════════════════════════════════════════════════════════
  /**
   * Dự báo "Ngày hết tiền" bằng Weighted Linear Regression trên dữ liệu DB thực.
   *
   * Query params:
   *   lookbackDays?    = số ngày lịch sử cần phân tích (mặc định 30, tối đa 180)
   *   overrideBalance? = override số dư nếu muốn kiểm thử với con số khác
   *
   * Response:
   * {
   *   "success": true,
   *   "prediction": {
   *     "status": "WARNING",
   *     "message": "...",
   *     "predictedDate": "2026-05-01T...",
   *     "daysRemaining": 24,
   *     "burnRatePerDay": 350000,
   *     "currentBalance": 8400000,
   *     "rSquared": 0.9432,
   *     "stdDevDays": 3,
   *     "dataPoints": [...]
   *   }
   * }
   */
  @Get('predict-broke-day')
  async predictBrokeDay(@Req() req: any, @Query() query: PredictBrokeDayDto) {
    const userId: string = req.user?.sub;
    const lookbackDays = Math.min(
      180,
      Math.max(3, parseInt(String(query.lookbackDays ?? '30'), 10) || 30),
    );
    const overrideBalance = query.overrideBalance
      ? parseFloat(String(query.overrideBalance))
      : undefined;

    this.logger.log(
      `[PREDICT] userId=${userId} | lookbackDays=${lookbackDays} | overrideBalance=${overrideBalance ?? 'auto'}`,
    );

    const prediction = await this.aiService.predictOutOfMoneyDay(
      userId,
      lookbackDays,
      overrideBalance,
    );

    return {
      success: true,
      prediction,
    };
  }

  // ══════════════════════════════════════════════════════════
  //  POST /ai/predict-broke-day  (body version)
  // ══════════════════════════════════════════════════════════
  /**
   * Phiên bản POST để FE có thể truyền body thay vì query params.
   */
  @Post('predict-broke-day')
  async predictBrokeDayPost(@Req() req: any, @Body() body: PredictBrokeDayDto) {
    const userId: string = req.user?.sub;
    const lookbackDays = Math.min(
      180,
      Math.max(3, parseInt(String(body.lookbackDays ?? '30'), 10) || 30),
    );

    const prediction = await this.aiService.predictOutOfMoneyDay(
      userId,
      lookbackDays,
      body.overrideBalance,
    );

    return {
      success: true,
      prediction,
    };
  }

  // ══════════════════════════════════════════════════════════
  //  POST /ai/analyze  – Phân tích sức khỏe tài chính toàn diện
  // ══════════════════════════════════════════════════════════
  /**
   * Phân tích sức khỏe tài chính tháng hiện tại của user.
   *
   * Input: Snapshot thu nhập + từng hũ (budget, spent, balance trong tháng).
   * Output:
   *   - analysis  : Văn bản phân tích tiếng Việt từ AI (persona ARIA)
   *   - alerts    : Mảng chuỗi cảnh báo ngắn gọn cho Frontend hiển thị badge
   *   - forecast  : Map số học (surplus, saving rate, burn rate...) cho chart/widget
   *
   * Body (AnalyzeFinanceDto):
   * {
   *   "totalIncome":        15000000,
   *   "currentDayOfMonth":  19,
   *   "totalDaysInMonth":   30,
   *   "pockets": [
   *     {
   *       "id":                "uuid-...",
   *       "name":              "Nhu cầu thiết yếu",
   *       "targetPercentage":  50,
   *       "monthlyBudget":     7500000,
   *       "spentThisMonth":    4200000,
   *       "currentBalance":    3300000
   *     },
   *     ...
   *   ],
   *   "userQuestion": "Tôi có nên mua điện thoại mới tháng này không?" // optional
   * }
   */
  @Post('analyze')
  async analyzeFinancialHealth(@Req() req: any, @Body() body: AnalyzeFinanceDto) {
    const userId: string = req.user?.sub;

    if (!body.pockets?.length) {
      throw new BadRequestException('Cần cung cấp ít nhất 1 hũ tài chính để phân tích.');
    }
    if (!body.totalIncome || body.totalIncome <= 0) {
      throw new BadRequestException('Tổng thu nhập phải lớn hơn 0.');
    }

    this.logger.log(
      `[ANALYZE] userId=${userId} | income=${body.totalIncome} | day=${body.currentDayOfMonth}/${body.totalDaysInMonth} | pockets=${body.pockets.length}`,
    );

    const result = await this.aiService.analyzeFinancialHealth(userId, {
      totalIncome:       body.totalIncome,
      currentDayOfMonth: body.currentDayOfMonth,
      totalDaysInMonth:  body.totalDaysInMonth,
      pockets:           body.pockets,
      userQuestion:      body.userQuestion,
    });

    return {
      success: true,
      ...result,
    };
  }

  // ══════════════════════════════════════════════════════════
  //  POST /ai/chat  – Chat với Trợ lý AI có ngữ cảnh DB thật
  // ══════════════════════════════════════════════════════════

  /**
   * Nhắn tin với trợ lý AI tài chính cá nhân.
   * Tự động nạp dữ liệu Ví, Giao dịch 30 ngày, Mục tiêu tiết kiệm
   * của user từ DB để Gemini có context trả lời chính xác.
   *
   * Body: { "message": "Tài chính của tôi thế nào?" }
   * Response: { "reply": "..." }
   */
  @Post('chat')
  async chat(@Req() req: any, @Body() body: { message: string }) {
    const userId: string = req.user?.sub;
    if (!body.message?.trim()) {
      throw new BadRequestException('Thiếu trường message.');
    }
    this.logger.log(`[CHAT] userId=${userId} | message="${body.message.slice(0, 60)}..."`);
    const reply = await this.aiService.chatAssistant(userId, body.message);
    return { reply };
  }
}

