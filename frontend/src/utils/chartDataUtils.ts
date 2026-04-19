/**
 * chartDataUtils.ts
 * -----------------
 * Utility for generating timezone-aware chart data for the "Xu hướng Thu Chi" chart.
 *
 * ✅ Requirements:
 *  - Luôn hiển thị đủ 7 hoặc 30 ngày gần nhất tính đến HÔM NAY (Asia/Ho_Chi_Minh)
 *  - Ngày nào không có giao dịch → income = 0, expense = 0  (zero-fill)
 *  - Tuần bắt đầu từ Thứ Hai (ISO 8601 / Monday-first)
 *  - Dùng date-fns + locale vi để format nhãn tiếng Việt chính xác
 *
 * Timezone strategy:
 *  - Không dùng `new Date()` raw vì Node/Browser default về UTC hoặc system tz
 *  - Dùng `toZonedTime` (date-fns-tz) hoặc offset cố định +7h để tính "hôm nay VN"
 *  - date-fns locale vi cung cấp: Th 2, Th 3, ..., CN (Monday-first theo ISO)
 */

import {
  eachDayOfInterval,
  format,
  parseISO,
  startOfDay,
  addHours,
  startOfWeek,
  endOfWeek,
  startOfMonth,
} from 'date-fns';
import { vi } from 'date-fns/locale';

// ─── Constants ───────────────────────────────────────────────────────────────

/** VN timezone offset: UTC+7 (fixed, không đổi DST) */
const VN_OFFSET_HOURS = 7;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChartPoint {
  /** "YYYY-MM-DD" theo giờ Việt Nam */
  date: string;
  /** Nhãn hiển thị trên XAxis (ví dụ: "Th 2", "19/04") */
  label: string;
  income: number;
  expense: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Trả về Date object đại diện cho "hôm nay" theo giờ Asia/Ho_Chi_Minh.
 *
 * Cách tính: lấy UTC hiện tại + 7h → đây là "giờ Hà Nội" trong biểu diễn UTC.
 * `startOfDay` cắt về 00:00:00 của ngày đó.
 *
 * Note: Date object này vẫn mang nhãn UTC nhưng giá trị số của ngày/tháng/năm
 * tương ứng với VN local date — đủ để tạo key "YYYY-MM-DD" chính xác.
 */
function getTodayInVN(): Date {
  const utcNow = new Date();
  // Dịch sang "VN wall-clock" bằng cách cộng offset vào UTC
  const vnNow = addHours(utcNow, VN_OFFSET_HOURS);
  // Cắt về midnight của ngày đó
  return startOfDay(vnNow);
}

/**
 * Chuyển một UTC Date từ backend → date key "YYYY-MM-DD" theo giờ VN.
 * Dùng khi merge dữ liệu transactions (stored as UTC) về VN local date.
 */
export function toVnDateKey(utcDate: Date): string {
  const vnDate = addHours(utcDate, VN_OFFSET_HOURS);
  return format(vnDate, 'yyyy-MM-dd');
}

/**
 * Trả về date key "YYYY-MM-DD" của hôm nay theo giờ VN.
 */
export function getTodayVn(): string {
  return format(getTodayInVN(), 'yyyy-MM-dd');
}

/**
 * buildLabel — sinh nhãn XAxis theo locale vi
 *
 * Mode 7 ngày  → Weekday viết tắt: "Th 2" | "Th 3" | ... | "CN"
 *                date-fns format 'EEEEEE' + locale vi → "Th 2", "CN", v.v.
 *                Tuần bắt đầu Thứ Hai vì locale vi mặc định ISO week (Mon=1)
 *
 * Mode 30 ngày → "19/04" (dd/MM)
 *
 * @param dateKey  "YYYY-MM-DD"
 * @param isWeekMode  true = 7d, false = 1m
 */
function buildLabel(dateKey: string, isWeekMode: boolean): string {
  // parseISO('2026-04-19') → Date object giữ nguyên ngày (không shift timezone)
  // vì đây chỉ là ngày, không có giờ, không bị UTC offset ảnh hưởng
  const d = parseISO(dateKey);

  if (isWeekMode) {
    // 'EEEEEE' = shortest weekday abbreviation (Mon=first với locale vi)
    // Kết quả: "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN"
    return format(d, 'EEEEEE', { locale: vi });
  }

  // '1m' mode: "19/04"
  return format(d, 'dd/MM', { locale: vi });
}

/**
 * buildZeroFilledRange
 * ---------------------
 * Tạo Map<dateKey, {income:0, expense:0}> theo logic:
 *
 * Ví dụ 7d: Từ Thứ 2 -> Chủ Nhật của TUẦN HIỆN TẠI (tuần có thể có ngày tương lai).
 * Ví dụ 1m: Từ ngày 1 -> HÔM NAY của THÁNG HIỆN TẠI (tuyệt đối không hiển thị tương lai gộp).
 *
 * Tất cả entries đều được khởi tạo với income=0, expense=0.
 * Ngày thiếu giao dịch → giữ nguyên 0, không bị bỏ sót.
 */
function buildZeroFilledRange(
  period: '7d' | '1m',
): Map<string, { income: number; expense: number }> {
  const todayVN = getTodayInVN(); // midnight của hôm nay (VN)
  let startVN: Date;
  let endVN: Date;

  if (period === '7d') {
      // Tuần bắt đầu từ Thứ Hai (weekStartsOn: 1) tới Chủ Nhật
      startVN = startOfWeek(todayVN, { weekStartsOn: 1 });
      endVN = endOfWeek(todayVN, { weekStartsOn: 1 });
  } else {
      // Với tháng: Từ mùng 1 đầu tháng tới Hôm Nay (Tuyệt đối không lấy ngày chưa tới)
      startVN = startOfMonth(todayVN);
      endVN = todayVN;
  }

  // eachDayOfInterval tạo mảng mỗi ngày từ start → end, INCLUSIVE cả 2 đầu
  const days_in_range = eachDayOfInterval({ start: startVN, end: endVN });

  const map = new Map<string, { income: number; expense: number }>();
  for (const day of days_in_range) {
    const key = format(day, 'yyyy-MM-dd'); // "YYYY-MM-DD"
    map.set(key, { income: 0, expense: 0 });
  }

  return map;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * generateChartData
 * -----------------
 * Hàm chính — merge dữ liệu từ API backend với range zero-filled.
 *
 * Pipeline:
 *  1. Tạo Map đầy đủ các ngày tuỳ theo period (tất cả = 0)  → buildZeroFilledRange()
 *  2. Duyệt apiData, ghi đè 0 bằng giá trị thực   → chỉ set ngày nằm trong range
 *  3. Sort chronological → map về ChartPoint[]     → buildLabel()
 *
 * Guarantees:
 *  ✅ 7d:  Luôn hiển thị T2 -> CN
 *  ✅ 1m:  Từ ngày mùng 1 tới HÔM NAY (không hiển thị tương lai)
 *  ✅ Ngày không có giao dịch → income=0, expense=0
 *  ✅ Tuần bắt đầu Thứ Hai (date-fns locale vi)
 *  ✅ Labels tiếng Việt: "Th 2"..."CN" / "19/04"
 *
 * @param apiData  Mảng ChartPoint trả về từ GET /transactions/chart
 * @param period   '7d' | '1m'
 */
export function generateChartData(
  apiData: ChartPoint[],
  period: '7d' | '1m',
): ChartPoint[] {
  const isWeekMode = period === '7d';

  // Bước 1: Skeleton đầy đủ — tất cả ngày = 0
  const dayMap = buildZeroFilledRange(period);

  // Bước 2: Ghi đè bằng dữ liệu thực từ backend
  for (const point of apiData) {
    // Nếu BE trả về point của ngày thuộc hàm, nó sẽ ghi đè lên số 0
    if (dayMap.has(point.date)) {
      dayMap.set(point.date, {
        income:  point.income,
        expense: point.expense,
      });
    }
  }

  // Bước 3: Convert về ChartPoint[] theo thứ tự thời gian
  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))   // "YYYY-MM-DD" sort = chronological
    .map(([date, vals]) => ({
      date,
      label:   buildLabel(date, isWeekMode),
      income:  vals.income,
      expense: vals.expense,
    }));
}
