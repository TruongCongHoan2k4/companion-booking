// rentalVenuesUtil.js

/**
 * Chia chuỗi raw thành mảng theo dòng, trim từng dòng, bỏ các dòng rỗng
 * @param {string} raw
 * @returns {string[]}
 */
export function parseRentalVenues(raw) {
  if (!raw || !raw.trim()) {
    return [];
  }
  return raw
    .split(/\r?\n/) // tách theo newline, hỗ trợ \n và \r\n
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
