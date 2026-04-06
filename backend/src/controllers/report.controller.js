import * as reportService from '../services/report.service.js';

function handle(res, err) {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Lỗi máy chủ.' });
}

export const create = async (req, res) => {
  try {
    const item = await reportService.createReport(req.auth.userId, req.body);
    res.status(201).json(item);
  } catch (err) {
    handle(res, err);
  }
};

export const listMine = async (req, res) => {
  try {
    const items = await reportService.listMyReports(req.auth.userId);
    res.json(items);
  } catch (err) {
    handle(res, err);
  }
};

