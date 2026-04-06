import * as walletService from '../services/wallet.service.js';

export const me = async (req, res) => {
  try {
    const data = await walletService.getWalletMe(req.auth.userId);
    res.json(data);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Không tải được ví.' });
  }
};

export const deposit = async (req, res) => {
  try {
    const result = await walletService.deposit(req.auth.userId, req.body.amount, req.body.provider);
    res.status(201).json({
      message: 'Nạp tiền thành công.',
      walletBalance: result.walletBalance,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Nạp tiền thất bại.' });
  }
};

export const withdrawRequest = async (req, res) => {
  try {
    const result = await walletService.withdrawRequest(req.auth.userId, req.body);
    res.status(201).json({
      message: 'Đã tạo lệnh rút tiền. Vui lòng chờ xử lý.',
      withdrawalId: result.id,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Tạo lệnh rút tiền thất bại.' });
  }
};

export const myWithdrawals = async (req, res) => {
  try {
    const items = await walletService.listMyWithdrawals(req.auth.userId);
    res.json({ items });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Không tải được danh sách rút tiền.' });
  }
};
