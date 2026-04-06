import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { requireCustomer } from '../middleware/requireCustomer.middleware.js';
import { validateMongoIdParam } from '../middleware/mongoIdParam.middleware.js';
import * as favoriteController from '../controllers/favorite.controller.js';

const router = express.Router();

router.use(verifyToken);
router.use(requireCustomer);

router.get('/me', favoriteController.listMine);
router.post('/:companionId', validateMongoIdParam('companionId'), favoriteController.add);
router.delete('/:companionId', validateMongoIdParam('companionId'), favoriteController.remove);

export default router;

