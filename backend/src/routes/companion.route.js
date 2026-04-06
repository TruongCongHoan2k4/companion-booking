import express from 'express';
import { verifyToken, optionalVerifyToken } from '../middleware/verifyToken.middleware.js';
import { requireCompanion } from '../middleware/requireCompanion.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { identityUploadMiddleware } from '../middleware/multerIdentity.middleware.js';
import { validateMongoIdParam } from '../middleware/mongoIdParam.middleware.js';
import {
  identityBodySchema,
  servicePriceCreateSchema,
  servicePriceUpdateSchema,
} from '../validations/servicePrice.validation.js';
import * as companionController from '../controllers/companion.controller.js';
import * as companionMeController from '../controllers/companionMe.controller.js';
import * as servicePriceController from '../controllers/servicePrice.controller.js';
import * as companionCatalogController from '../controllers/companionCatalog.controller.js';

const router = express.Router();

/** Khu vực companion đăng nhập — mount tại /me */
const meRouter = express.Router();
meRouter.use(verifyToken);
meRouter.use(requireCompanion);

meRouter.get('/bookings/workflow', companionMeController.bookingWorkflow);
meRouter.get('/bookings', companionMeController.listBookings);
meRouter.patch(
  '/bookings/:bookingId',
  validateMongoIdParam('bookingId'),
  companionMeController.patchBooking
);
meRouter.post(
  '/bookings/:bookingId/sos',
  validateMongoIdParam('bookingId'),
  companionMeController.postSos
);
meRouter.post(
  '/bookings/:bookingId/extension/accept',
  validateMongoIdParam('bookingId'),
  companionMeController.extensionStub
);
meRouter.post(
  '/bookings/:bookingId/extension/reject',
  validateMongoIdParam('bookingId'),
  companionMeController.extensionStub
);

meRouter.get('/profile', companionMeController.getProfile);
meRouter.put('/profile', companionMeController.putProfile);
meRouter.put('/media-skills', companionMeController.putMediaSkills);
meRouter.patch('/online', companionMeController.patchOnline);

meRouter.get('/income-stats', companionMeController.incomeStats);

meRouter.get('/consultations', companionMeController.listConsultations);
meRouter.patch(
  '/consultations/:id/answer',
  validateMongoIdParam('id'),
  companionMeController.patchConsultationAnswer
);

meRouter.get('/withdrawals', companionMeController.listWithdrawals);
meRouter.post('/withdrawals', companionMeController.createWithdrawal);

meRouter.get('/bank-account', companionMeController.getBankAccount);
meRouter.put('/bank-account', companionMeController.putBankAccount);

meRouter.put(
  '/identity',
  identityUploadMiddleware,
  validateBody(identityBodySchema),
  companionController.updateIdentity
);

meRouter.get('/service-prices', servicePriceController.listMine);
meRouter.post(
  '/service-prices',
  validateBody(servicePriceCreateSchema),
  servicePriceController.createMine
);
meRouter.put(
  '/service-prices/:id',
  validateBody(servicePriceUpdateSchema),
  servicePriceController.updateMine
);
meRouter.delete('/service-prices/:id', servicePriceController.deleteMine);

router.use('/me', meRouter);

/** Khách / công khai: xem danh sách companion đã duyệt */
router.get('/search', optionalVerifyToken, companionCatalogController.searchCompanions);
router.get('/', optionalVerifyToken, companionCatalogController.listCompanions);
router.post('/register', verifyToken, companionCatalogController.registerCompanion);
router.get(
  '/:id/service-prices',
  validateMongoIdParam('id'),
  optionalVerifyToken,
  companionCatalogController.listCompanionServicePrices
);
router.get(
  '/:id',
  validateMongoIdParam('id'),
  optionalVerifyToken,
  companionCatalogController.getCompanionById
);

export default router;
