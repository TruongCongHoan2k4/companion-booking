import * as bookingService from '../services/booking.service.js';
import * as chatService from '../services/chat.service.js';
import * as bookingNotify from '../services/bookingNotify.service.js';

export const create = async (req, res) => {
  try {
    const booking = await bookingService.createBooking(req.auth.userId, req.body);
    await bookingNotify.notifyBookingCreated(booking);
    res.status(201).json({ message: 'Đặt lịch thành công, đang chờ companion xác nhận.', booking });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Đặt lịch thất bại.' });
  }
};

export const listMine = async (req, res) => {
  try {
    const items = await bookingService.listBookingsForUser(req.auth.userId, req.auth.role, req.query);
    res.json({ items });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được danh sách đơn.' });
  }
};

export const workflow = async (req, res) => {
  try {
    const booking = await bookingService.workflowBooking(
      req.companion._id,
      req.params.id,
      req.body.action
    );
    await bookingNotify.notifyBookingWorkflow(booking, req.body.action);
    res.json({
      message:
        req.body.action === 'ACCEPT'
          ? 'Đã chấp nhận đơn.'
          : 'Đã từ chối đơn; cọc đã hoàn cho khách.',
      booking,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Cập nhật trạng thái thất bại.' });
  }
};

export const getMessages = async (req, res) => {
  try {
    const items = await chatService.listMessagesForUser(req.params.id, req.auth.userId);
    res.json({ items });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Không tải được tin nhắn.' });
  }
};

export const checkIn = async (req, res) => {
  try {
    const out = await bookingService.checkInBooking(req.auth.userId, req.auth.role, req.params.id);
    const step = out?.step || 'CONFIRMED';
    const booking = out?.booking || out;
    res.json({
      message:
        step === 'REQUESTED'
          ? 'Đã gửi yêu cầu check-in. Chờ bên còn lại xác nhận.'
          : 'Check-in đã được xác nhận. Phiên đã bắt đầu.',
      booking,
      step,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Check-in thất bại.' });
  }
};

export const checkOut = async (req, res) => {
  try {
    const out = await bookingService.checkOutBooking(req.auth.userId, req.auth.role, req.params.id);
    const step = out?.step || 'CONFIRMED';
    const booking = out?.booking || out;
    res.json({
      message:
        step === 'REQUESTED'
          ? 'Đã gửi yêu cầu check-out. Chờ bên còn lại xác nhận.'
          : 'Check-out đã được xác nhận. Đơn đã hoàn tất.',
      booking,
      step,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Check-out thất bại.' });
  }
};

export const cancel = async (req, res) => {
  try {
    const booking = await bookingService.cancelBooking(req.auth.userId, req.auth.role, req.params.id);
    res.json({ message: 'Đã hủy đơn.', booking });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Hủy đơn thất bại.' });
  }
};

export const extensionRequest = async (req, res) => {
  try {
    const booking = await bookingService.requestBookingExtension(req.auth.userId, req.params.id, req.body?.extraMinutes);
    res.json({ message: 'Đã gửi yêu cầu gia hạn.', booking });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Xin gia hạn thất bại.' });
  }
};

export const extensionCancel = async (req, res) => {
  try {
    const booking = await bookingService.cancelBookingExtensionRequest(req.auth.userId, req.params.id);
    res.json({ message: 'Đã hủy yêu cầu gia hạn.', booking });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Hủy gia hạn thất bại.' });
  }
};
