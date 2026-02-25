import Group from '../models/Group.js';
import Expense from '../models/Expense.js';
import Settlement from '../models/Settlement.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { optimizeSettlements } from '../utils/optimizeSettlements.js';
import { sendEmail } from '../utils/mailer.js';

export const triggerSmartReminders = async () => {
  const groups = await Group.find({ archived: false }).populate('members.user');
  let nudgeCount = 0;

  for (const group of groups) {
    const expenses = await Expense.find({ groupId: group._id });
    const settlements = await Settlement.find({ groupId: group._id, status: 'completed' });

    const optimized = optimizeSettlements(expenses, settlements);

    // Transfers show who owes whom
    for (const transfer of optimized) {
      const debtorId = transfer.from;
      const creditorId = transfer.to;
      const amount = transfer.amount;

      // Smart Nudge Logic: Only nudge if no reminder sent today for this group/debtor
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const existingNudge = await Notification.findOne({
        userId: debtorId,
        groupId: group._id,
        type: 'reminder',
        createdAt: { $gte: startOfDay }
      });

      if (!existingNudge) {
        const debtor = group.members.find(m => m.user._id.toString() === debtorId)?.user;
        const creditor = group.members.find(m => m.user._id.toString() === creditorId)?.user;

        if (debtor && creditor) {
          const message = `Smart Nudge: You still have a pending balance of ₹${amount} with ${creditor.name} in ${group.name}.`;

          // 1. In-app
          await Notification.create({
            userId: debtorId,
            groupId: group._id,
            type: 'reminder',
            message,
            metadata: { creditorId, amount, isAuto: true }
          });

          // 2. Email
          await sendEmail({
            to: debtor.email,
            subject: `Splitly: Friendly Nudge for ${group.name} 🔔`,
            html: `
              <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Hey ${debtor.name},</h2>
                <p>Just a quick smart nudge from Splitly! You have an outstanding balance in <strong>${group.name}</strong>.</p>
                <div style="background: #FFF9E6; padding: 20px; border-radius: 12px; border: 1px solid #FFEBB3; margin: 20px 0;">
                  <p style="font-size: 24px; font-weight: 700; color: #B25E00; margin: 0;">₹${amount}</p>
                  <p style="margin: 8px 0 0; color: #666;">Owed to ${creditor.name}</p>
                </div>
                <p>Settling up keeps everyone happy! Click below to see the details.</p>
                <a href="http://localhost:5173/groups/${group._id}" style="display: inline-block; background: #007AFF; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Group</a>
              </div>
            `
          });
          nudgeCount++;
        }
      }
    }
  }
  return nudgeCount;
};
