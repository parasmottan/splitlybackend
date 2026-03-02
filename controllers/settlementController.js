import Settlement from '../models/Settlement.js';
import Expense from '../models/Expense.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
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

// GET /api/settlements/:groupId/upi-details/:toUserId
// Returns server-validated amount and receiver UPI ID for a specific transfer.
export const getUpiPaymentDetails = async (req, res, next) => {
  try {
    const { groupId, toUserId } = req.params;
    const fromUserId = req.user._id.toString();

    // Verify group exists and user is a member
    const group = await Group.findById(groupId).lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const isMember = group.members.some(m => m.user.toString() === fromUserId);
    if (!isMember) return res.status(403).json({ message: 'You are not a member of this group' });

    // Server-side authoritative calculation
    const expenses = await Expense.find({ groupId }).lean();
    const completedSettlements = await Settlement.find({ groupId, status: 'completed' }).lean();
    const optimized = optimizeSettlements(expenses, completedSettlements);

    // Find the specific transfer this user owes to toUser
    const transfer = optimized.find(
      t => t.from === fromUserId && t.to === toUserId
    );

    if (!transfer) {
      return res.status(404).json({ message: 'No outstanding amount found for this transfer' });
    }

    // Fetch receiver UPI ID
    const receiver = await User.findById(toUserId).select('name upiId').lean();
    if (!receiver) return res.status(404).json({ message: 'Receiver not found' });

    if (!receiver.upiId) {
      return res.status(422).json({ message: `${receiver.name} hasn't set their UPI ID yet` });
    }

    res.json({
      amount: transfer.amount,
      upiId: receiver.upiId,
      receiverName: receiver.name,
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
