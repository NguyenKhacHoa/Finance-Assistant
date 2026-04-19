import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionCategory, Pocket } from '@prisma/client';

export interface ClassificationResult {
  category: TransactionCategory | null;
  targetPocket: Pocket | null;
  suggestedName: string;
}

@Injectable()
export class TransactionClassifierService {
  constructor(private readonly prisma: PrismaService) {}

  // Danh sách từ khóa phân loại cứng
  private readonly RULES = [
    {
      category: TransactionCategory.Transport,
      keywords: ['grab', 'be', 'gojek', 'xang', 'petro', 'taxi'],
      pocketKeywords: ['di chuyển', 'đi lại', 'xăng', 'xe', 'transport'],
    },
    {
      category: TransactionCategory.Shopping,
      keywords: ['shopee', 'lazada', 'tiki', 'tiktok shop', 'mua sam'],
      pocketKeywords: ['mua sắm', 'shopping', 'tiêu dùng', 'cá nhân'],
    },
    {
      category: TransactionCategory.Utility,
      keywords: ['internet', 'tien dien', 'tien nuoc', 'wifi', 'viettel', 'vnpt', 'fpt'],
      pocketKeywords: ['hóa đơn', 'sinh hoạt', 'điện nước', 'tiện ích', 'utility'],
    },
    {
      category: TransactionCategory.Food,
      keywords: ['food', 'baemin', 'shopeefood', 'an uong', 'cafe', 'highland', 'starbucks', 'kfc', 'mcdonald'],
      pocketKeywords: ['ăn uống', 'thức ăn', 'ăn', 'food', 'cafe'],
    }
  ];

  /**
   * Bước 1: Dùng Regex phân nhóm giao dịch theo nội dung
   */
  private detectCategory(description: string): { category: TransactionCategory, pocketKeywords: string[] } | null {
    if (!description) return null;
    const normalizedDesc = this.removeVietnameseTones(description.toLowerCase());

    for (const rule of this.RULES) {
      for (const keyword of rule.keywords) {
        if (normalizedDesc.includes(keyword)) {
          return { category: rule.category, pocketKeywords: rule.pocketKeywords };
        }
      }
    }
    return null;
  }

  /**
   * Bước 2: Tìm Pocket phù hợp theo nhóm Category đã phân loại
   */
  private matchPocket(pockets: Pocket[], pocketKeywords: string[]): Pocket | null {
    for (const pocket of pockets) {
      const normalizedName = this.removeVietnameseTones((pocket.name + ' ' + (pocket.shortName || '')).toLowerCase());
      for (const keyword of pocketKeywords) {
        if (normalizedName.includes(this.removeVietnameseTones(keyword))) {
          return pocket;
        }
      }
    }
    return null;
  }

  /**
   * Hàm chính để phân loại
   */
  async classify(userId: string, description: string): Promise<ClassificationResult> {
    const defaultResult: ClassificationResult = { category: null, targetPocket: null, suggestedName: 'Chưa phân loại' };

    // 1. Regex tìm Category
    const detection = this.detectCategory(description);
    if (!detection) {
      return defaultResult;
    }

    // 2. Tìm danh sách Pockets của User
    const userPockets = await this.prisma.pocket.findMany({
      where: { userId: userId },
    });

    // 3. Match hũ (Pocket)
    const matchedPocket = this.matchPocket(userPockets, detection.pocketKeywords);

    return {
      category: detection.category,
      targetPocket: matchedPocket,
      suggestedName: this.getCategoryNameVn(detection.category),
    };
  }

  private removeVietnameseTones(str: string): string {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    return str;
  }

  private getCategoryNameVn(cat: TransactionCategory): string {
    const map: Record<string, string> = {
      Transport: 'Di chuyển',
      Shopping: 'Mua sắm',
      Utility: 'Hóa đơn',
      Food: 'Ăn uống'
    };
    return map[cat as string] || cat;
  }
}
