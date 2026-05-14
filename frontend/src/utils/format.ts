/**
 * Định dạng số tiền VNĐ theo chuẩn Việt Nam:
 *   - Dùng dấu chấm (.) làm phân cách hàng nghìn: 5.500.000
 *   - Suffix: " VNĐ"
 *   - compact mode: rút gọn ≥ 1tr → "5,5tr VNĐ"
 */
export const formatVND = (amount: number, compact: boolean = false): string => {
  if (amount === undefined || amount === null) return '0 VNĐ';

  if (compact && Math.abs(amount) >= 1_000_000) {
    const millions = amount / 1_000_000;
    const formatted = Number.isInteger(millions)
      ? millions.toLocaleString('vi-VN')
      : millions.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return `${formatted}tr VNĐ`;
  }

  // Dùng 'de-DE' locale để nhận dấu chấm (.) làm phân cách hàng nghìn
  // ví dụ: 5500000 → "5.500.000"
  const formatted = Math.abs(amount)
    .toLocaleString('de-DE', { maximumFractionDigits: 0 });
  const sign = amount < 0 ? '-' : '';
  return `${sign}${formatted} VNĐ`;
};

export const parseVNDToNumber = (value: string): number => {
  if (!value) return 0;
  // Hỗ trợ cả dấu chấm (de-DE) lẫn dấu phẩy (vi-VN cũ) làm phân cách
  return parseInt(value.replace(/[.,]/g, ''), 10) || 0;
};

export const formatInputVND = (value: string): string => {
  const num = parseVNDToNumber(value);
  if (num === 0 && !value) return '';
  return num.toLocaleString('de-DE', { maximumFractionDigits: 0 });
};

