import express from 'express';
import { getInsights } from '../controllers/insightsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/', getInsights);

export default router;
