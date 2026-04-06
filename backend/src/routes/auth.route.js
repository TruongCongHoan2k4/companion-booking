import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  patchMeSchema,
  changePasswordSchema,
} from '../validations/auth.validation.js';

const router = express.Router();

router.post('/register', validateBody(registerSchema), authController.register);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/forgot-password', validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
router.get('/me', verifyToken, authController.me);
router.patch('/me', verifyToken, validateBody(patchMeSchema), authController.patchMe);
router.put('/change-password', verifyToken, validateBody(changePasswordSchema), authController.changePassword);
router.post('/logout', authController.logout);

export default router;
