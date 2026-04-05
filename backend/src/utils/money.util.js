import mongoose from 'mongoose';

/** Chuỗi số nguyên VNĐ từ Decimal128 / giá trị lưu DB. */
export function decimal128ToBigInt(d) {
  if (d == null) return 0n;
  const s = typeof d === 'object' && typeof d.toString === 'function' ? d.toString() : String(d);
  if (!s || s === '0' || s === '0.0') return 0n;
  const intPart = s.split('.')[0];
  return BigInt(intPart);
}

export function bigIntToDecimal128(b) {
  return mongoose.Types.Decimal128.fromString(b.toString());
}

/** Làm tròn lên: ceil(a / b), a,b > 0 */
export function ceilDiv(a, b) {
  if (b <= 0n) throw new Error('ceilDiv: b phải dương');
  return (a + b - 1n) / b;
}

/** Giá giữ cọc: ceil(durationPhút * giáMỗiGiờ / 60) */
export function computeHoldAmountVnd(durationMinutes, pricePerHourDec) {
  const dur = BigInt(Math.floor(Number(durationMinutes)));
  const price = decimal128ToBigInt(pricePerHourDec);
  if (dur <= 0n || price < 0n) return 0n;
  return ceilDiv(dur * price, 60n);
}
