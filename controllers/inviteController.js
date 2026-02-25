import crypto from 'crypto';
import Group from '../models/Group.js';
import User from '../models/User.js';
import GroupInvite from '../models/GroupInvite.js';
import { sendEmail } from '../utils/mailer.js';

const inviteEmailTemplate = (groupName, inviterName, joinUrl) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; }
        .container { max-width: 440px; margin: 40px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .header { padding: 40px 20px 20px; text-align: center; }
        .logo { width: 40px; height: 40px; background: #007AFF; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        .logo-icon { width: 24px; height: 24px; background: white; border-radius: 4px; position: relative; }
        .logo-icon::after { content: ''; position: absolute; width: 12px; height: 12px; border: 2.5px solid #007AFF; border-radius: 2px; top: 3px; left: 3px; }
        .app-name { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-left: 8px; vertical-align: middle; }
        .content { padding: 0 40px 40px; text-align: center; }
        h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 12px; font-weight: 800; }
        p { color: #666; font-size: 15px; line-height: 1.5; margin-bottom: 32px; }
        .btn { display: inline-block; background: #007AFF; color: #ffffff; padding: 16px 32px; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 16px; transition: background 0.2s; }
        .footer { padding: 20px 40px 40px; border-top: 1px solid #f0f0f0; text-align: center; color: #999; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo"><div class="logo-icon"></div></div>
            <span class="app-name">Splitly</span>
        </div>
        <div class="content">
            <h1>Join ${groupName}</h1>
            <p><strong>${inviterName}</strong> has invited you to join their group on Splitly and start tracking shared expenses together.</p>
            <a href="${joinUrl}" class="btn">Join Group</a>
            <p style="margin-top: 32px; font-size: 13px; color: #999;">This invite link will expire in 48 hours.</p>
        </div>
        <div class="footer">
            Splitly Inc. • San Francisco, CA
        </div>
    </div>
</body>
</html>
`;

export const inviteByEmails = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;
    const { emails } = req.body; // Expects an array of emails
    const inviterId = req.user.id;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: 'Email addresses are required' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const inviter = await User.findById(inviterId);

    const results = { added: [], invited: [], errors: [] };

    for (const email of emails) {
      const normalizedEmail = email.toLowerCase().trim();

      // Check if already a member
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        const isMember = group.members.some(m => m.user.toString() === existingUser._id.toString());
        if (isMember) {
          results.errors.push({ email: normalizedEmail, error: 'User is already a member' });
          continue;
        }

        // Add directly to group
        group.members.push({ user: existingUser._id, role: 'member' });
        results.added.push(normalizedEmail);

        // Notify existing user (optional, can add Notification later)
      } else {
        // Create pending invite
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

        await GroupInvite.create({
          groupId,
          invitedEmail: normalizedEmail,
          invitedBy: inviterId,
          inviteToken,
          expiresAt
        });

        // Send email
        const joinUrl = `http://localhost:5173/join/${inviteToken}`;
        await sendEmail({
          to: normalizedEmail,
          subject: `${inviter.name} invited you to join ${group.name} on Splitly`,
          html: inviteEmailTemplate(group.name, inviter.name, joinUrl)
        });

        results.invited.push(normalizedEmail);
      }
    }

    if (results.added.length > 0) {
      await group.save();
    }

    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

export const verifyInvite = async (req, res, next) => {
  try {
    const { token } = req.params;
    const invite = await GroupInvite.findOne({ inviteToken: token, status: 'pending' }).populate('groupId', 'name');

    if (!invite) {
      return res.status(404).json({ message: 'Invite not found or already used' });
    }

    if (new Date() > invite.expiresAt) {
      invite.status = 'expired';
      await invite.save();
      return res.status(400).json({ message: 'Invite has expired' });
    }

    res.status(200).json({
      groupName: invite.groupId.name,
      invitedEmail: invite.invitedEmail,
      inviteToken: token
    });
  } catch (error) {
    next(error);
  }
};

export const acceptInvite = async (req, res, next) => {
  try {
    const { token } = req.body;
    const invite = await GroupInvite.findOne({ inviteToken: token, status: 'pending' });

    if (!invite) {
      return res.status(404).json({ message: 'Invite not found or already used' });
    }

    const group = await Group.findById(invite.groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group no longer exists' });
    }

    // Add user to group members
    const isMember = group.members.some(m => m.user.toString() === req.user.id.toString());
    if (!isMember) {
      group.members.push({ user: req.user.id, role: 'member' });
      await group.save();
    }

    // Update invite status
    invite.status = 'accepted';
    await invite.save();

    res.status(200).json({ success: true, groupId: group._id });
  } catch (error) {
    next(error);
  }
};

export const getPendingInvites = async (req, res, next) => {
  try {
    const { id: groupId } = req.params;
    const invites = await GroupInvite.find({ groupId, status: 'pending' });
    res.status(200).json(invites);
  } catch (error) {
    next(error);
  }
};

export const cancelInvite = async (req, res, next) => {
  try {
    const { inviteId } = req.params;
    const invite = await GroupInvite.findById(inviteId);
    if (!invite) return res.status(404).json({ message: 'Invite not found' });

    invite.status = 'cancelled';
    await invite.save();
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
