// analyze.dto.ts — Plain TypeScript DTO (no class-validator dependency)
// Matches the project's existing DTO pattern (see ocr.dto.ts, predict.dto.ts)

export class PocketSnapshotDto {
  /** UUID của hũ trong DB */
  id: string;

  /** Tên hũ (dùng để hiển thị trong phân tích) */
  name: string;

  /** Tỷ lệ % đã thiết lập cho hũ (0–100) */
  targetPercentage: number;

  /** Ngân sách tháng = totalIncome * targetPercentage / 100 */
  monthlyBudget: number;

  /** Tổng số tiền đã chi trong tháng hiện tại */
  spentThisMonth: number;

  /** Số dư hiện tại còn trong hũ */
  currentBalance: number;
}

export class AnalyzeFinanceDto {
  /** Tổng thu nhập tháng này (VNĐ, sau khi phân bổ) */
  totalIncome: number;

  /** Ngày hiện tại trong tháng (1–31) */
  currentDayOfMonth: number;

  /** Tổng số ngày trong tháng (28/29/30/31) */
  totalDaysInMonth: number;

  /** Danh sách snapshot từng hũ */
  pockets: PocketSnapshotDto[];

  /** (Optional) Câu hỏi cụ thể của user để AI trả lời thêm */
  userQuestion?: string;
}
