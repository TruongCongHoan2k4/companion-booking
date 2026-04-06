import * as companionCatalogService from '../services/companionCatalog.service.js';

function handleError(res, err) {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Lỗi máy chủ.' });
}

export const listCompanions = async (req, res) => {
  try {
    const data = await companionCatalogService.listApprovedCompanions();
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const searchCompanions = async (req, res) => {
  try {
    const data = await companionCatalogService.searchApprovedCompanions(req.query || {});
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const getCompanionById = async (req, res) => {
  try {
    const data = await companionCatalogService.getApprovedCompanionById(req.params.id);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const listCompanionServicePrices = async (req, res) => {
  try {
    const data = await companionCatalogService.listPublicServicePrices(req.params.id);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const registerCompanion = async (req, res) => {
  try {
    const result = await companionCatalogService.registerCompanionApplication(req.auth.userId, req.body || {});
    res.status(201).json({ message: 'Đã gửi đăng ký companion.', ...result });
  } catch (err) {
    handleError(res, err);
  }
};

export const applicationMe = async (req, res) => {
  try {
    const data = await companionCatalogService.getMyCompanionApplication(req.auth.userId);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const applicationIdentity = async (req, res) => {
  try {
    const data = await companionCatalogService.updateMyCompanionApplicationIdentity(
      req.auth.userId,
      req.body || {},
      req.files || {}
    );
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};
