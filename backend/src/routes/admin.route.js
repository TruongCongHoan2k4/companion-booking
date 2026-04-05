import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { requireAdmin } from '../middleware/requireAdmin.middleware.js';
import * as adminController from '../controllers/admin.controller.js';

const router = express.Router();

router.use(verifyToken);
router.use(requireAdmin);

router.get('/dashboard-stats', adminController.dashboardStats);

export default router;
