export class PredictBrokeDayDto {
  /**
   * Số ngày lịch sử chi tiêu cần lấy để phân tích (mặc định 30 ngày)
   */
  lookbackDays?: number;
  /**
   * Override số dư hiện tại nếu không muốn tự động lấy từ DB
   */
  overrideBalance?: number;
}
