import * as reviewService from '../services/review.service.js';

function handle(res, err) {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Lỗi máy chủ.' });
}

export const create = async (req, res) => {
  try {
    const item = await reviewService.createReview(req.auth.userId, req.body);
    res.status(201).json(item);
  } catch (err) {
    handle(res, err);
  }
};

export const listMine = async (req, res) => {
  try {
    const items = await reviewService.listMyReviews(req.auth.userId);
    res.json(items);
  } catch (err) {
    handle(res, err);
  }
};

