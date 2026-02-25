import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import { sendEmail } from '../utils/mailer.js';

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
};

export const markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Notification.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { isRead: true }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

// POST /api/notifications/remind
export const sendManualReminder = async (req, res, next) => {
  try {
    const { debtorId, groupId, amount, message } = req.body;
    const creditorId = req.user.id;

    if (!debtorId || !groupId || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Security Rules: Max 5 per day per debtor from this creditor
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await Notification.countDocuments({
      type: 'reminder',
      userId: debtorId,
      groupId,
      'metadata.creditorId': creditorId,
      createdAt: { $gte: startOfDay }
    });

    if (count >= 5) {
      return res.status(429).json({ message: 'Daily reminder limit reached for this user' });
    }

    const debtor = await User.findById(debtorId);
    const creditor = await User.findById(creditorId);
    const group = await Group.findById(groupId);

    if (!debtor || !creditor || !group) {
      return res.status(404).json({ message: 'User or Group not found' });
    }

    const reminderMsg = message || `Friendly nudge 👀 You still owe ₹${amount} in ${group.name}`;

    // 1. In-app notification
    await Notification.create({
      userId: debtorId,
      groupId,
      type: 'reminder',
      message: reminderMsg,
      metadata: {
        creditorId,
        amount,
        groupName: group.name
      }
    });

    // 2. Email fallback (casual tone)
    await sendEmail({
      to: debtor.email,
      subject: `Splitly reminder: Balance pending in ${group.name} 💸`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Hey ${debtor.name},</h2>
          <p>${creditor.name} sent you a quick reminder about your pending balance in <strong>${group.name}</strong>.</p>
          <div style="background: #EBF5FF; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <p style="font-size: 24px; font-weight: 700; color: #007AFF; margin: 0;">₹${amount}</p>
            <p style="margin: 8px 0 0; color: #666;">${reminderMsg}</p>
          </div>
          <a href="https://splitly-phi.vercel.app/groups/${groupId}" style="display: inline-block; background: #007AFF; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Settle Up Now</a>
          <p style="margin-top: 30px; font-size: 13px; color: #999;">Splitly: Tracking expenses so you don't have to.</p>
        </div>
      `
    });

    res.status(200).json({ success: true, message: 'Reminder sent' });
  } catch (error) {
    next(error);
  }
};
