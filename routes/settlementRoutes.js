import express from 'express';
import { getSettlements, settleAll, settleSingle } from '../controllers/settlementController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/:groupId', getSettlements);
router.post('/:groupId/settle-all', settleAll);
router.post('/:groupId/settle-single', settleSingle);

export default router;
