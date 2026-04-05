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
    const result = await walletService.depositMock(req.auth.userId, req.body.amount);
    res.status(201).json({
      message: 'Nạp tiền (mock) thành công.',
      walletBalance: result.walletBalance,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Nạp tiền thất bại.' });
  }
};
