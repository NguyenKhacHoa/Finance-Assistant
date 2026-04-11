export const formatVND = (amount: number, compact: boolean = false): string => {
  if (amount === undefined || amount === null) return '0 ₫';
  
  if (compact && Math.abs(amount) >= 1_000_000) {
    const formatted = new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1
    }).format(amount);
    return formatted.replace('T', 'tr') + ' ₫'; // Vietnamese compact
  }

  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
};

export const parseVNDToNumber = (value: string): number => {
  if (!value) return 0;
  return parseInt(value.replace(/\./g, ''), 10) || 0;
};

export const formatInputVND = (value: string): string => {
  const num = parseVNDToNumber(value);
  if (num === 0 && !value) return '';
  return new Intl.NumberFormat('vi-VN').format(num);
};
