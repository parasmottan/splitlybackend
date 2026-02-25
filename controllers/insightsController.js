import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Group from '../models/Group.js';
import { optimizeSettlements } from '../utils/optimizeSettlements.js';

// GET /api/insights
export const getInsights = async (req, res, next) => {
  try {
    const { groupId } = req.query; // optional filter

    let groups;
    if (groupId) {
      groups = await Group.find({ _id: groupId, 'members.user': req.user._id }).lean();
    } else {
      groups = await Group.find({ 'members.user': req.user._id }).lean();
    }

    const groupIds = groups.map(g => g._id);
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Current month expenses
    const currentExpenses = await Expense.find({
      groupId: { $in: groupIds },
      createdAt: { $gte: thisMonth }
    }).lean();

    // Last month expenses
    const lastMonthExpenses = await Expense.find({
      groupId: { $in: groupIds },
      createdAt: { $gte: lastMonth, $lte: lastMonthEnd }
    }).lean();

    // All expenses for overall stats
    const allExpenses = await Expense.find({
      groupId: { $in: groupIds }
    }).lean();

    // Total spent (all time for the selected scope)
    const totalSpent = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
    const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Your share calculation
    let yourShare = 0;
    for (const e of currentExpenses) {
      const userSplit = e.splits.find(s => s.user.toString() === req.user._id.toString());
      if (userSplit) yourShare += userSplit.amount;
    }

    // Spending by category
    const categoryTotals = {};
    for (const e of currentExpenses) {
      const cat = e.category || 'other';
      const label = {
        food: 'Food & Dining',
        transport: 'Transport',
        groceries: 'Groceries',
        entertainment: 'Entertainment',
        utilities: 'Utilities',
        rent: 'Rent',
        travel: 'Travel',
        shopping: 'Shopping',
        other: 'Others'
      }[cat] || 'Others';

      if (!categoryTotals[label]) categoryTotals[label] = 0;
      categoryTotals[label] += e.amount;
    }

    const categories = Object.entries(categoryTotals)
      .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);

    // Fairness score calculation
    // Based on how close to equal the payments are among members
    let fairnessScore = 100;
    if (allExpenses.length > 0) {
      const allGroupMembers = new Set();
      const memberPaid = {};

      for (const g of groups) {
        for (const m of g.members) {
          allGroupMembers.add(m.user.toString());
        }
      }

      for (const e of currentExpenses) {
        const payerId = e.paidBy.toString();
        if (!memberPaid[payerId]) memberPaid[payerId] = 0;
        memberPaid[payerId] += e.amount;
      }

      const totalMembers = allGroupMembers.size;
      if (totalMembers > 1 && totalSpent > 0) {
        const idealShare = totalSpent / totalMembers;
        let totalDeviation = 0;

        for (const uid of allGroupMembers) {
          const paid = memberPaid[uid] || 0;
          totalDeviation += Math.abs(paid - idealShare);
        }

        const maxDeviation = totalSpent * 2;
        fairnessScore = Math.max(0, Math.round(100 * (1 - totalDeviation / maxDeviation)));
      }
    }

    // Month over month comparison
    const monthChange = lastMonthTotal > 0
      ? Math.round(((totalSpent - lastMonthTotal) / lastMonthTotal) * 100)
      : 0;

    // Available groups for the filter tabs
    const groupTabs = groups.map(g => ({
      _id: g._id,
      name: g.name
    }));

    res.json({
      fairnessScore,
      totalSpent: Math.round(totalSpent * 100) / 100,
      yourShare: Math.round(yourShare * 100) / 100,
      sharePercentage: totalSpent > 0 ? Math.round((yourShare / totalSpent) * 1000) / 10 : 0,
      monthChange,
      categories,
      groupTabs
    });
  } catch (error) {
    next(error);
  }
};
