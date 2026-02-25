import Settlement from '../models/Settlement.js';
import Expense from '../models/Expense.js';
import Group from '../models/Group.js';
import { optimizeSettlements } from '../utils/optimizeSettlements.js';

// GET /api/settlements/:groupId
export const getSettlements = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId)
      .populate('members.user', 'name email avatar')
      .lean();
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const expenses = await Expense.find({ groupId }).lean();
    const completedSettlements = await Settlement.find({
      groupId,
      status: 'completed'
    }).lean();

    const optimized = optimizeSettlements(expenses, completedSettlements);
    const totalToSettle = optimized.reduce((sum, t) => sum + t.amount, 0);

    // Map user IDs to user objects
    const memberMap = {};
    for (const m of group.members) {
      memberMap[m.user._id.toString()] = m.user;
    }

    const detailedTransfers = optimized.map(t => ({
      from: memberMap[t.from] || { _id: t.from, name: 'Unknown' },
      to: memberMap[t.to] || { _id: t.to, name: 'Unknown' },
      amount: t.amount
    }));

    // Get the most recent expense description for each transfer as context
    const expenseMap = {};
    for (const e of expenses) {
      const payerId = e.paidBy.toString();
      if (!expenseMap[payerId]) {
        expenseMap[payerId] = e.description;
      }
    }

    const transfersWithContext = detailedTransfers.map(t => ({
      ...t,
      context: expenseMap[t.to._id.toString()] || ''
    }));

    res.json({
      totalToSettle: Math.round(totalToSettle * 100) / 100,
      pendingCount: optimized.length,
      transfers: transfersWithContext,
      currencySymbol: group.currencySymbol
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/settlements/:groupId/settle-all
export const settleAll = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const expenses = await Expense.find({ groupId }).lean();
    const completedSettlements = await Settlement.find({
      groupId,
      status: 'completed'
    }).lean();

    const optimized = optimizeSettlements(expenses, completedSettlements);

    // Create settlement records for each transfer
    const settlements = await Promise.all(
      optimized.map(t =>
        Settlement.create({
          groupId,
          fromUser: t.from,
          toUser: t.to,
          amount: t.amount,
          status: 'completed'
        })
      )
    );

    res.json({
      message: 'All balances settled',
      settlements
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/settlements/:groupId/settle-single
export const settleSingle = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { fromUser, toUser, amount } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const settlement = await Settlement.create({
      groupId,
      fromUser,
      toUser,
      amount,
      status: 'completed'
    });

    const populated = await Settlement.findById(settlement._id)
      .populate('fromUser', 'name email avatar')
      .populate('toUser', 'name email avatar');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};
