import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { validateMongoIdParam } from '../middleware/mongoIdParam.middleware.js';
import * as chatController from '../controllers/chat.controller.js';

const router = express.Router();

router.use(verifyToken);

router.get('/:bookingId/messages', validateMongoIdParam('bookingId'), chatController.listMessages);
router.post('/:bookingId/messages', validateMongoIdParam('bookingId'), chatController.postMessage);
router.get('/:bookingId/call', validateMongoIdParam('bookingId'), chatController.callInfo);

export default router;

