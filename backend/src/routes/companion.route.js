import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { requireCompanion } from '../middleware/requireCompanion.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { identityUploadMiddleware } from '../middleware/multerIdentity.middleware.js';
import {
  identityBodySchema,
  servicePriceCreateSchema,
  servicePriceUpdateSchema,
} from '../validations/servicePrice.validation.js';
import * as companionController from '../controllers/companion.controller.js';
import * as servicePriceController from '../controllers/servicePrice.controller.js';

const router = express.Router();

router.use(verifyToken);
router.use(requireCompanion);

router.put(
  '/me/identity',
  identityUploadMiddleware,
  validateBody(identityBodySchema),
  companionController.updateIdentity
);

router.get('/me/service-prices', servicePriceController.listMine);
router.post(
  '/me/service-prices',
  validateBody(servicePriceCreateSchema),
  servicePriceController.createMine
);
router.put(
  '/me/service-prices/:id',
  validateBody(servicePriceUpdateSchema),
  servicePriceController.updateMine
);
router.delete('/me/service-prices/:id', servicePriceController.deleteMine);

export default router;
