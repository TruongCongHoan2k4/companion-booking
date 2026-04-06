import * as favoriteService from '../services/favorite.service.js';

function handle(res, err) {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Lỗi máy chủ.' });
}

export const listMine = async (req, res) => {
  try {
    const items = await favoriteService.listFavoritesForCustomer(req.auth.userId);
    res.json(items);
  } catch (err) {
    handle(res, err);
  }
};

export const add = async (req, res) => {
  try {
    const item = await favoriteService.addFavorite(req.auth.userId, req.params.companionId);
    res.status(201).json(item);
  } catch (err) {
    handle(res, err);
  }
};

export const remove = async (req, res) => {
  try {
    await favoriteService.removeFavorite(req.auth.userId, req.params.companionId);
    res.json({ ok: true });
  } catch (err) {
    handle(res, err);
  }
};

