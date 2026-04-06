import * as chatService from '../services/chat.service.js';

function handle(res, err) {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Lỗi máy chủ.' });
}

export const listMessages = async (req, res) => {
  try {
    const items = await chatService.listMessagesForUser(req.params.bookingId, req.auth.userId);
    // UI hiện tại có 2 kiểu: list item {senderUsername...} và list item {sender:{username}}
    // Để tương thích, bọc lại `sender` dạng object.
    res.json(
      items.map((m) => ({
        ...m,
        sender: { id: m.senderId, username: m.senderUsername },
      }))
    );
  } catch (err) {
    handle(res, err);
  }
};

export const postMessage = async (req, res) => {
  try {
    const item = await chatService.createMessageForUser(req.params.bookingId, req.auth.userId, req.body?.content);
    res.status(201).json({
      ...item,
      sender: { id: item.senderId, username: item.senderUsername },
    });
  } catch (err) {
    handle(res, err);
  }
};

export const callInfo = async (req, res) => {
  try {
    const info = await chatService.getCallInfoForUser(req.params.bookingId, req.auth.userId);
    res.json(info);
  } catch (err) {
    handle(res, err);
  }
};

