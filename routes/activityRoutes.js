import express from 'express';
import { getActivity } from '../controllers/activityController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/', getActivity);

export default router;
