import * as companionMeService from '../services/companionMe.service.js';
import * as bookingNotify from '../services/bookingNotify.service.js';

export const listBookings = async (req, res) => {
  try {
    const items = await companionMeService.listCompanionBookings(req.auth.userId);
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được danh sách booking.' });
  }
};

export const bookingWorkflow = async (req, res) => {
  try {
    const data = await companionMeService.companionBookingWorkflow(req.auth.userId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được workflow booking.' });
  }
};

export const incomeStats = async (req, res) => {
  try {
    const data = await companionMeService.companionIncomeStats(req.auth.userId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được thống kê thu nhập.' });
  }
};

export const patchBooking = async (req, res) => {
  try {
    const booking = await companionMeService.companionPatchBooking(
      req.companion,
      req.params.bookingId,
      req.body
    );
    const action = req.body?.status === 'ACCEPTED' ? 'ACCEPT' : 'REJECT';
    await bookingNotify.notifyBookingWorkflow(booking, action);
    res.json({ message: 'Đã cập nhật trạng thái đơn.', booking });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Cập nhật thất bại.' });
  }
};

export const postSos = async (req, res) => {
  try {
    const note = req.body?.note ?? '';
    const booking = await companionMeService.companionSos(req.companion, req.params.bookingId, note);
    res.json({ message: 'Đã ghi nhận SOS.', booking });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Gửi SOS thất bại.' });
  }
};

export const extensionStub = (req, res) => {
  res.json({ ok: true, message: 'Gia hạn chưa được kích hoạt trên backend.' });
};

export const getProfile = async (req, res) => {
  try {
    res.json(companionMeService.toCompanionProfileJson(req.companion));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được hồ sơ.' });
  }
};

export const putProfile = async (req, res) => {
  try {
    const data = await companionMeService.updateCompanionProfile(req.companion, req.body || {});
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Cập nhật hồ sơ thất bại.' });
  }
};

export const putMediaSkills = async (req, res) => {
  try {
    const data = await companionMeService.updateCompanionMediaSkills(req.companion, req.body || {});
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Cập nhật media/kỹ năng thất bại.' });
  }
};

export const patchOnline = async (req, res) => {
  try {
    const online = req.body?.online === true || req.body?.online === 'true';
    const data = await companionMeService.setCompanionOnline(req.companion, online);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Cập nhật trạng thái online thất bại.' });
  }
};

export const listConsultations = async (req, res) => {
  try {
    const items = await companionMeService.listConsultations(req.companion);
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được tư vấn.' });
  }
};

export const patchConsultationAnswer = async (req, res) => {
  try {
    await companionMeService.answerConsultation(req.companion, req.params.id, req.body?.answer);
    res.json({ ok: true });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Trả lời thất bại.' });
  }
};

export const listWithdrawals = async (req, res) => {
  try {
    const items = await companionMeService.listWithdrawals(req.companion);
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được lệnh rút tiền.' });
  }
};

export const createWithdrawal = async (req, res) => {
  try {
    await companionMeService.createWithdrawal(req.companion, req.body || {});
    res.status(201).json({ message: 'Đã tạo lệnh rút tiền.' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Tạo lệnh rút thất bại.' });
  }
};

export const getBankAccount = async (req, res) => {
  try {
    res.json(companionMeService.getBankAccount(req.companion));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được tài khoản ngân hàng.' });
  }
};

export const putBankAccount = async (req, res) => {
  try {
    const data = await companionMeService.updateBankAccount(req.companion, req.body || {});
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Lưu tài khoản ngân hàng thất bại.' });
  }
};
