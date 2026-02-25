import express from 'express';
import { addExpense, getExpenses } from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', addExpense);
router.get('/:groupId', getExpenses);

export default router;
