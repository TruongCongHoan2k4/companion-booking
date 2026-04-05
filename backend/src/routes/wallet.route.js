import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { walletDepositSchema } from '../validations/wallet.validation.js';
import * as walletController from '../controllers/wallet.controller.js';

const router = express.Router();

router.use(verifyToken);

router.get('/me', walletController.me);
router.post('/deposit', validateBody(walletDepositSchema), walletController.deposit);

export default router;
