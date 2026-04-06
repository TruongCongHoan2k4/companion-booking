import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { requireCustomer } from '../middleware/requireCustomer.middleware.js';
import { requireCompanion } from '../middleware/requireCompanion.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { validateMongoIdParam } from '../middleware/mongoIdParam.middleware.js';
import {
  createBookingSchema,
  bookingWorkflowSchema,
  bookingExtensionRequestSchema,
} from '../validations/booking.validation.js';
import * as bookingController from '../controllers/booking.controller.js';

const router = express.Router();

router.use(verifyToken);

router.post('/', requireCustomer, validateBody(createBookingSchema), bookingController.create);
router.get('/me', bookingController.listMine);
router.patch(
  '/me/:id/check-in',
  validateMongoIdParam('id'),
  bookingController.checkIn
);
router.patch(
  '/me/:id/check-out',
  validateMongoIdParam('id'),
  bookingController.checkOut
);
router.patch('/me/:id/cancel', validateMongoIdParam('id'), bookingController.cancel);
router.post(
  '/me/:id/extension-request',
  validateMongoIdParam('id'),
  validateBody(bookingExtensionRequestSchema),
  bookingController.extensionRequest
);
router.post(
  '/me/:id/extension-request/cancel',
  validateMongoIdParam('id'),
  bookingController.extensionCancel
);
router.get(
  '/:id/messages',
  validateMongoIdParam('id'),
  bookingController.getMessages
);
router.patch(
  '/:id/workflow',
  validateMongoIdParam('id'),
  requireCompanion,
  validateBody(bookingWorkflowSchema),
  bookingController.workflow
);

export default router;
