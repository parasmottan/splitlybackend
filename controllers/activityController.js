import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';

// GET /api/activity
export const getActivity = async (req, res, next) => {
  try {
    // Get all groups the user is in
    const groups = await Group.find({ 'members.user': req.user._id })
      .select('_id name currencySymbol')
      .lean();

    const groupIds = groups.map(g => g._id);
    const groupMap = {};
    for (const g of groups) {
      groupMap[g._id.toString()] = g;
    }

    // Get expenses
    const expenses = await Expense.find({ groupId: { $in: groupIds } })
      .populate('paidBy', 'name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    // Get settlements
    const settlements = await Settlement.find({
      groupId: { $in: groupIds },
      status: 'completed'
    })
      .populate('fromUser', 'name email avatar')
      .populate('toUser', 'name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    // Combine and sort
    const activities = [];

    for (const expense of expenses) {
      const group = groupMap[expense.groupId.toString()];
      const isPayer = expense.paidBy._id.toString() === req.user._id.toString();
      const userSplit = expense.splits.find(s => s.user.toString() === req.user._id.toString());

      let amount = 0;
      if (isPayer) {
        // You paid, so you're owed (amount - your split)
        amount = expense.amount - (userSplit ? userSplit.amount : 0);
      } else if (userSplit) {
        // Someone else paid, you owe your split
        amount = -userSplit.amount;
      }

      activities.push({
        type: 'expense',
        _id: expense._id,
        description: expense.description,
        groupName: group ? group.name : 'Unknown',
        groupId: expense.groupId,
        amount: Math.round(amount * 100) / 100,
        totalAmount: expense.amount,
        paidBy: expense.paidBy,
        currencySymbol: group ? group.currencySymbol : '₹',
        date: expense.createdAt,
        category: expense.category
      });
    }

    for (const settlement of settlements) {
      const group = groupMap[settlement.groupId.toString()];
      const isFrom = settlement.fromUser._id.toString() === req.user._id.toString();

      activities.push({
        type: 'settlement',
        _id: settlement._id,
        description: 'Settlement',
        groupName: group ? group.name : 'Unknown',
        groupId: settlement.groupId,
        amount: isFrom ? -settlement.amount : settlement.amount,
        totalAmount: settlement.amount,
        paidBy: isFrom ? settlement.fromUser : settlement.toUser,
        otherUser: isFrom ? settlement.toUser : settlement.fromUser,
        currencySymbol: group ? group.currencySymbol : '₹',
        date: settlement.createdAt,
        category: 'settlement'
      });
    }

    // Sort by date descending
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group by date
    const grouped = {};
    for (const activity of activities) {
      const date = new Date(activity.date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let dateKey;
      if (date.toDateString() === today.toDateString()) {
        dateKey = 'TODAY';
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateKey = 'YESTERDAY';
      } else {
        dateKey = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();
      }

      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(activity);
    }

    res.json(grouped);
  } catch (error) {
    next(error);
  }
};
