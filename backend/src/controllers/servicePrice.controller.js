import * as servicePriceService from '../services/servicePrice.service.js';

export const listMine = async (req, res) => {
  try {
    const items = await servicePriceService.listByCompanion(req.companion._id);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được bảng giá.' });
  }
};

export const createMine = async (req, res) => {
  try {
    const item = await servicePriceService.createForCompanion(req.companion._id, req.body);
    res.status(201).json({ message: 'Đã thêm dịch vụ.', item });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Tạo bảng giá thất bại.' });
  }
};

export const updateMine = async (req, res) => {
  try {
    const item = await servicePriceService.updateForCompanion(
      req.companion._id,
      req.params.id,
      req.body
    );
    res.json({ message: 'Đã cập nhật.', item });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Cập nhật thất bại.' });
  }
};

export const deleteMine = async (req, res) => {
  try {
    await servicePriceService.deleteForCompanion(req.companion._id, req.params.id);
    res.json({ message: 'Đã xóa.' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Xóa thất bại.' });
  }
};
