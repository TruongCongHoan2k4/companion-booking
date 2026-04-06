import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { reportCreateSchema } from '../validations/report.validation.js';
import * as reportController from '../controllers/report.controller.js';

const router = express.Router();

router.use(verifyToken);

router.get('/me', reportController.listMine);
router.post('/', validateBody(reportCreateSchema), reportController.create);

export default router;

