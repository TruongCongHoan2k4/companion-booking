import Booking from '../models/booking.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function sumWalletByType(type) {
  const [row] = await WalletTransaction.aggregate([
    { $match: { type } },
    {
      $addFields: {
        amt: { $toDouble: { $toString: '$amount' } },
      },
    },
    { $group: { _id: null, total: { $sum: '$amt' } } },
  ]);
  return row?.total != null ? Math.round(row.total) : 0;
}

export async function getDashboardStats() {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    bookingByMonth,
    chargeByMonth,
    totalBookings,
    totalChargeRevenue,
    totalDeposits,
    cancelledBookings,
    totalTransactions,
  ] = await Promise.all([
    Booking.aggregate([
      { $match: { createdAt: { $gte: rangeStart } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' },
          },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    WalletTransaction.aggregate([
      {
        $match: {
          type: 'CHARGE',
          createdAt: { $gte: rangeStart },
        },
      },
      {
        $addFields: {
          amt: { $toDouble: { $toString: '$amount' } },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' },
          },
          revenueVnd: { $sum: '$amt' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.countDocuments(),
    sumWalletByType('CHARGE'),
    sumWalletByType('DEPOSIT'),
    Booking.countDocuments({ status: 'CANCELLED' }),
    WalletTransaction.countDocuments(),
  ]);

  const orderMap = new Map(bookingByMonth.map((x) => [x._id, x.orderCount]));
  const revenueMap = new Map(
    chargeByMonth.map((x) => [x._id, Math.round(x.revenueVnd || 0)])
  );

  const byMonth = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    byMonth.push({
      month: key,
      orders: orderMap.get(key) || 0,
      revenueVnd: revenueMap.get(key) || 0,
    });
  }

  return {
    summary: {
      totalBookings,
      totalRevenueVnd: totalChargeRevenue,
      totalDepositsVnd: totalDeposits,
    },
    byMonth,
    /** Khớp trang admin dashboard (public/js/admin.js). */
    platformProfit: totalChargeRevenue,
    totalTransactions,
    cancelledBookings,
  };
}
