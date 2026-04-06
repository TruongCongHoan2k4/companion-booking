import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { requireCustomer } from '../middleware/requireCustomer.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { reviewCreateSchema } from '../validations/review.validation.js';
import * as reviewController from '../controllers/review.controller.js';

const router = express.Router();

router.use(verifyToken);

router.get('/me', reviewController.listMine);
router.post('/', requireCustomer, validateBody(reviewCreateSchema), reviewController.create);

export default router;

