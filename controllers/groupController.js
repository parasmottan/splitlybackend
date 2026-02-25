import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import { optimizeSettlements } from '../utils/optimizeSettlements.js';

// POST /api/groups
export const createGroup = async (req, res, next) => {
  try {
    const { name, type, currency, currencySymbol } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const group = await Group.create({
      name,
      type: type || 'trip',
      currency: currency || 'INR',
      currencySymbol: currencySymbol || '₹',
      owner: req.user._id,
      members: [{ user: req.user._id, role: 'owner' }]
    });

    const populated = await Group.findById(group._id)
      .populate('members.user', 'name email avatar')
      .populate('owner', 'name email avatar');

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

// GET /api/groups
export const getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({
      'members.user': req.user._id
    })
      .populate('members.user', 'name email avatar')
      .populate('owner', 'name email avatar')
      .sort({ updatedAt: -1 })
      .lean();

    // Compute balance summary for each group
    const groupsWithBalances = await Promise.all(
      groups.map(async (group) => {
        const expenses = await Expense.find({ groupId: group._id }).lean();
        const completedSettlements = await Settlement.find({
          groupId: group._id,
          status: 'completed'
        }).lean();

        const optimized = optimizeSettlements(expenses, completedSettlements);

        // Calculate current user's net position
        let userOwes = 0;
        let userIsOwed = 0;
        const userId = req.user._id.toString();

        for (const transfer of optimized) {
          if (transfer.from === userId) userOwes += transfer.amount;
          if (transfer.to === userId) userIsOwed += transfer.amount;
        }

        const totalSpend = expenses.reduce((sum, e) => sum + e.amount, 0);
        const lastExpense = expenses.length > 0 ? expenses[expenses.length - 1] : null;

        return {
          ...group,
          balance: {
            youOwe: Math.round(userOwes * 100) / 100,
            youAreOwed: Math.round(userIsOwed * 100) / 100,
            totalSpend: Math.round(totalSpend * 100) / 100,
            isSettled: optimized.length === 0
          },
          lastActivity: lastExpense ? {
            description: lastExpense.description,
            date: lastExpense.createdAt,
            addedBy: lastExpense.paidBy
          } : null,
          expenseCount: expenses.length
        };
      })
    );

    res.json(groupsWithBalances);
  } catch (error) {
    next(error);
  }
};

// GET /api/groups/:id
export const getGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members.user', 'name email avatar')
      .populate('owner', 'name email avatar')
      .lean();

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isMember = group.members.some(
      m => m.user._id.toString() === req.user._id.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this group' });
    }

    // Get expenses and compute balances
    const expenses = await Expense.find({ groupId: group._id })
      .populate('paidBy', 'name email avatar')
      .sort({ createdAt: -1 })
      .lean();

    const completedSettlements = await Settlement.find({
      groupId: group._id,
      status: 'completed'
    }).lean();

    const optimized = optimizeSettlements(expenses, completedSettlements);
    const totalSpend = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Compute per-member balances
    const memberBalances = {};
    for (const member of group.members) {
      const uid = member.user._id.toString();
      memberBalances[uid] = { paid: 0, owes: 0, net: 0 };
    }

    for (const expense of expenses) {
      const payerId = expense.paidBy._id.toString();
      if (memberBalances[payerId]) {
        memberBalances[payerId].paid += expense.amount;
      }
      for (const split of expense.splits) {
        const uid = split.user.toString();
        if (memberBalances[uid]) {
          memberBalances[uid].owes += split.amount;
        }
      }
    }

    // Adjust for completed settlements
    for (const s of completedSettlements) {
      const fromId = s.fromUser.toString();
      const toId = s.toUser.toString();
      if (memberBalances[fromId]) memberBalances[fromId].paid += s.amount;
      if (memberBalances[toId]) memberBalances[toId].owes += s.amount;
    }

    for (const uid of Object.keys(memberBalances)) {
      memberBalances[uid].net = Math.round((memberBalances[uid].paid - memberBalances[uid].owes) * 100) / 100;
    }

    // Current user's position
    const userId = req.user._id.toString();
    let userOwes = 0;
    let userIsOwed = 0;
    for (const transfer of optimized) {
      if (transfer.from === userId) userOwes += transfer.amount;
      if (transfer.to === userId) userIsOwed += transfer.amount;
    }

    // Pending settlements for current user
    const pendingSettlements = await Settlement.find({
      groupId: group._id,
      status: 'pending',
      $or: [{ fromUser: req.user._id }, { toUser: req.user._id }]
    })
      .populate('fromUser', 'name email avatar')
      .populate('toUser', 'name email avatar')
      .lean();

    res.json({
      ...group,
      expenses,
      balance: {
        youOwe: Math.round(userOwes * 100) / 100,
        youAreOwed: Math.round(userIsOwed * 100) / 100,
        totalSpend: Math.round(totalSpend * 100) / 100,
        isSettled: optimized.length === 0
      },
      memberBalances,
      optimizedTransfers: optimized,
      pendingSettlements
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/groups/join
export const joinGroup = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ message: 'Invite code is required' });
    }

    const group = await Group.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!group) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    if (group.archived) {
      return res.status(400).json({ message: 'This group is archived' });
    }

    const isMember = group.members.some(
      m => m.user.toString() === req.user._id.toString()
    );
    if (isMember) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }

    group.members.push({ user: req.user._id, role: 'member' });
    await group.save();

    const populated = await Group.findById(group._id)
      .populate('members.user', 'name email avatar')
      .populate('owner', 'name email avatar');

    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// PUT /api/groups/:id
export const updateGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can update group settings' });
    }

    const { name, currency, currencySymbol, type } = req.body;
    if (name) group.name = name;
    if (currency) group.currency = currency;
    if (currencySymbol) group.currencySymbol = currencySymbol;
    if (type) group.type = type;

    await group.save();

    const populated = await Group.findById(group._id)
      .populate('members.user', 'name email avatar')
      .populate('owner', 'name email avatar');

    res.json(populated);
  } catch (error) {
    next(error);
  }
};

// PUT /api/groups/:id/archive
export const archiveGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can archive the group' });
    }

    group.archived = true;
    await group.save();

    res.json({ message: 'Group archived', group });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/groups/:id
export const deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete the group' });
    }

    // Delete all related data
    await Expense.deleteMany({ groupId: group._id });
    await Settlement.deleteMany({ groupId: group._id });
    await Group.findByIdAndDelete(group._id);

    res.json({ message: 'Group deleted permanently' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/groups/:id/leave
export const leaveGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Owner cannot leave the group. Transfer ownership or delete the group.' });
    }

    group.members = group.members.filter(
      m => m.user.toString() !== req.user._id.toString()
    );
    await group.save();

    res.json({ message: 'Left the group' });
  } catch (error) {
    next(error);
  }
};

// GET /api/groups/:id/invite-code
export const getInviteCode = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.json({ inviteCode: group.inviteCode });
  } catch (error) {
    next(error);
  }
};
