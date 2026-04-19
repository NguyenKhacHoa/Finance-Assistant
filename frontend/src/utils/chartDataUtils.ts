/**
 * chartDataUtils.ts
 * -----------------
 * Utility for generating timezone-aware chart data for the "Xu hướng Thu Chi" chart.
 * Timezone: Asia/Ho_Chi_Minh (UTC+7)
 *
 * Week convention: Monday-first (ISO 8601).
 * Missing days are auto-filled with { income: 0, expense: 0 }.
 */

const TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 fixed offset

export interface ChartPoint {
  date: string;   // "YYYY-MM-DD" in VN local date
  label: string;  // display label for XAxis
  income: number;
  expense: number;
}

/**
 * Returns "YYYY-MM-DD" for the current moment in Asia/Ho_Chi_Minh timezone.
 */
export function getTodayVn(): string {
  const vnMs = Date.now() + VN_OFFSET_MS;
  return new Date(vnMs).toISOString().slice(0, 10);
}

/**
 * Returns the VN-local date key for a given UTC Date object.
 */
export function toVnDateKey(utcDate: Date): string {
  const vnMs = utcDate.getTime() + VN_OFFSET_MS;
  return new Date(vnMs).toISOString().slice(0, 10);
}

/**
 * Generates an XAxis label for a date string ("YYYY-MM-DD").
 *  - 7-day mode  → weekday short name  (e.g. "Th 2", "CN")
 *  - 30-day mode → DD/MM              (e.g. "19/04")
 *
 * Week starts on Monday (ISO 8601) as required.
 */
function buildLabel(dateKey: string, isWeekMode: boolean): string {
  // Parse as VN midnight to avoid UTC shift on the label
  const d = new Date(dateKey + 'T00:00:00+07:00');
  if (isWeekMode) {
    return d.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: TZ });
  }
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: TZ });
}

/**
 * Core utility: buildZeroFilledRange
 * -----------------------------------
 * Creates an ordered array of { date, income: 0, expense: 0 } entries
 * for the last `days` days, always ending with TODAY (VN time).
 *
 * Example for days=7 and today=2026-04-19:
 *   ["2026-04-13", "2026-04-14", ..., "2026-04-19"]
 */
function buildZeroFilledRange(days: number): Map<string, { income: number; expense: number }> {
  const nowVnMs = Date.now() + VN_OFFSET_MS;
  // Floor to today's midnight in VN
  const todayVnMidnightMs = nowVnMs - (nowVnMs % 86_400_000);
  // Start = today - (days - 1) so the last entry is today
  const startVnMidnightMs = todayVnMidnightMs - (days - 1) * 86_400_000;

  const map = new Map<string, { income: number; expense: number }>();
  for (let i = 0; i < days; i++) {
    const vnDayMs = startVnMidnightMs + i * 86_400_000;
    const key = new Date(vnDayMs).toISOString().slice(0, 10);
    map.set(key, { income: 0, expense: 0 });
  }
  return map;
}

/**
 * generateChartData
 * ------------------
 * Merges API response data (from backend) with a guaranteed zero-filled range.
 *
 * This is the CLIENT-SIDE safety net:
 *  1. Builds the full date range always ending at today (VN timezone).
 *  2. Merges backend data into the range.
 *  3. Any day missing from the backend gets income=0, expense=0.
 *  4. Returns a sorted, label-ready ChartPoint[].
 *
 * @param apiData - Array returned by GET /transactions/chart?period=...
 * @param period  - '7d' | '1m'
 */
export function generateChartData(
  apiData: ChartPoint[],
  period: '7d' | '1m',
): ChartPoint[] {
  const days = period === '1m' ? 30 : 7;
  const isWeekMode = days <= 7;

  // Step 1: Build zero-filled range (always current)
  const dayMap = buildZeroFilledRange(days);

  // Step 2: Merge API data — overwrite zeros with real values
  for (const point of apiData) {
    if (dayMap.has(point.date)) {
      dayMap.set(point.date, { income: point.income, expense: point.expense });
    }
    // Dates outside our range (e.g., stale backend data) are ignored
  }

  // Step 3: Produce sorted ChartPoint[] with labels
  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b)) // chronological order
    .map(([date, vals]) => ({
      date,
      label: buildLabel(date, isWeekMode),
      income: vals.income,
      expense: vals.expense,
    }));
}
