import Expense from '../models/Expense.js';
import Group from '../models/Group.js';

// POST /api/expenses
export const addExpense = async (req, res, next) => {
  try {
    const { groupId, description, amount, category, paidBy, splitType, splits } = req.body;

    if (!groupId || !description || !amount) {
      return res.status(400).json({ message: 'groupId, description, and amount are required' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.archived) {
      return res.status(400).json({ message: 'Cannot add expenses to an archived group' });
    }

    const isMember = group.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const actualPaidBy = paidBy || req.user._id;
    let computedSplits;

    if (splitType === 'custom' && splits && splits.length > 0) {
      computedSplits = splits;
    } else {
      // Equal split among all members
      const memberCount = group.members.length;
      const perPerson = Math.round((amount / memberCount) * 100) / 100;
      computedSplits = group.members.map(m => ({
        user: m.user,
        amount: perPerson
      }));

      // Adjust rounding difference on the first member
      const totalSplit = perPerson * memberCount;
      const diff = Math.round((amount - totalSplit) * 100) / 100;
      if (diff !== 0 && computedSplits.length > 0) {
        computedSplits[0].amount = Math.round((computedSplits[0].amount + diff) * 100) / 100;
      }
    }

    const expense = await Expense.create({
      groupId,
      description,
      amount,
      category: category || 'other',
      paidBy: actualPaidBy,
      splitType: splitType || 'equal',
      splits: computedSplits
    });

    // Update group's updatedAt
    group.updatedAt = new Date();
    await group.save();

    const populated = await Expense.findById(expense._id)
      .populate('paidBy', 'name email avatar');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// GET /api/expenses/:groupId
export const getExpenses = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isMember = group.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    const expenses = await Expense.find({ groupId })
      .populate('paidBy', 'name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    res.json(expenses);
  } catch (error) {
    next(error);
  }
};
