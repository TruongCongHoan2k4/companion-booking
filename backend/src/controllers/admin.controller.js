import * as adminStatsService from '../services/adminStats.service.js';

export const dashboardStats = async (req, res) => {
  try {
    const data = await adminStatsService.getDashboardStats();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được thống kê.' });
  }
};
