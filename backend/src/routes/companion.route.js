import express from 'express';
import { verifyToken, optionalVerifyToken } from '../middleware/verifyToken.middleware.js';
import { requireCompanion } from '../middleware/requireCompanion.middleware.js';
import { requireCustomer } from '../middleware/requireCustomer.middleware.js';
import { requireApprovedCompanion } from '../middleware/requireApprovedCompanion.middleware.js';
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

meRouter.get('/bookings/workflow', requireApprovedCompanion, companionMeController.bookingWorkflow);
meRouter.get('/bookings', requireApprovedCompanion, companionMeController.listBookings);
meRouter.patch(
  '/bookings/:bookingId',
  validateMongoIdParam('bookingId'),
  requireApprovedCompanion,
  companionMeController.patchBooking
);
meRouter.post(
  '/bookings/:bookingId/sos',
  validateMongoIdParam('bookingId'),
  requireApprovedCompanion,
  companionMeController.postSos
);
meRouter.post(
  '/bookings/:bookingId/extension/accept',
  validateMongoIdParam('bookingId'),
  requireApprovedCompanion,
  companionMeController.acceptExtension
);
meRouter.post(
  '/bookings/:bookingId/extension/reject',
  validateMongoIdParam('bookingId'),
  requireApprovedCompanion,
  companionMeController.rejectExtension
);

meRouter.get('/profile', companionMeController.getProfile);
meRouter.put('/profile', companionMeController.putProfile);
meRouter.put('/media-skills', companionMeController.putMediaSkills);
meRouter.patch('/online', requireApprovedCompanion, companionMeController.patchOnline);

meRouter.get('/income-stats', requireApprovedCompanion, companionMeController.incomeStats);

meRouter.get('/consultations', requireApprovedCompanion, companionMeController.listConsultations);
meRouter.patch(
  '/consultations/:id/answer',
  validateMongoIdParam('id'),
  requireApprovedCompanion,
  companionMeController.patchConsultationAnswer
);

meRouter.get('/withdrawals', requireApprovedCompanion, companionMeController.listWithdrawals);
meRouter.post('/withdrawals', requireApprovedCompanion, companionMeController.createWithdrawal);

meRouter.get('/bank-account', requireApprovedCompanion, companionMeController.getBankAccount);
meRouter.put('/bank-account', requireApprovedCompanion, companionMeController.putBankAccount);

meRouter.put(
  '/identity',
  identityUploadMiddleware,
  validateBody(identityBodySchema),
  companionController.updateIdentity
);

meRouter.get('/service-prices', servicePriceController.listMine);
meRouter.post(
  '/service-prices',
  requireApprovedCompanion,
  validateBody(servicePriceCreateSchema),
  servicePriceController.createMine
);
meRouter.put(
  '/service-prices/:id',
  requireApprovedCompanion,
  validateBody(servicePriceUpdateSchema),
  servicePriceController.updateMine
);
meRouter.delete('/service-prices/:id', requireApprovedCompanion, servicePriceController.deleteMine);

router.use('/me', meRouter);

/** Khách / công khai: xem danh sách companion đã duyệt */
router.get('/search', optionalVerifyToken, companionCatalogController.searchCompanions);
router.get('/', optionalVerifyToken, companionCatalogController.listCompanions);
router.post('/register', verifyToken, companionCatalogController.registerCompanion);
router.get('/application/me', verifyToken, requireCustomer, companionCatalogController.applicationMe);
router.put(
  '/application/identity',
  verifyToken,
  requireCustomer,
  identityUploadMiddleware,
  validateBody(identityBodySchema),
  companionCatalogController.applicationIdentity
);
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
