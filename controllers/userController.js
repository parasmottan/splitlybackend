import User from '../models/User.js';
import Group from '../models/Group.js';
import nodemailer from 'nodemailer';

// ─── PATCH /api/user/profile — update name ──────────────────────────────────
export const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name: name.trim() },
      { new: true, runValidators: true }
    );

    res.json({
      user: { _id: user._id, name: user.name, email: user.email, avatar: user.avatar, notificationPrefs: user.notificationPrefs }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── PATCH /api/user/password — change password ─────────────────────────────
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'All fields required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });

    const user = await User.findById(req.user._id).select('+password');
    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── DELETE /api/user — delete account ──────────────────────────────────────
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Remove user from all groups
    await Group.updateMany(
      { 'members.user': userId },
      { $pull: { members: { user: userId } } }
    );

    // Delete the user
    await User.findByIdAndDelete(userId);

    // Clear refresh token cookie
    res.cookie('refreshToken', '', { httpOnly: true, expires: new Date(0) });
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── PATCH /api/user/notifications — update notification prefs ─────────────
export const updateNotificationPrefs = async (req, res) => {
  try {
    const { expenseAlerts, settlementAlerts, groupInvites, weeklySummary } = req.body;

    const updates = {};
    if (expenseAlerts !== undefined) updates['notificationPrefs.expenseAlerts'] = expenseAlerts;
    if (settlementAlerts !== undefined) updates['notificationPrefs.settlementAlerts'] = settlementAlerts;
    if (groupInvites !== undefined) updates['notificationPrefs.groupInvites'] = groupInvites;
    if (weeklySummary !== undefined) updates['notificationPrefs.weeklySummary'] = weeklySummary;

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true });

    res.json({ notificationPrefs: user.notificationPrefs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/user/me-full — full profile with notification prefs ────────────
export const getFullProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        notificationPrefs: user.notificationPrefs,
        createdAt: user.createdAt,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/user/support — send support message ─────────────────────────
export const sendSupportMessage = async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) return res.status(400).json({ message: 'Subject and message are required' });

    const user = await User.findById(req.user._id);

    // Use the existing SMTP config from .env
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.SMTP_USER,
      subject: `[Capaz Support] ${subject}`,
      html: `
        <h2>Support Request</h2>
        <p><strong>From:</strong> ${user.name} (${user.email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr/>
        <p>${message.replace(/\n/g, '<br/>')}</p>
      `,
    });

    res.json({ message: 'Support request sent successfully' });
  } catch (err) {
    // Even if email fails, acknowledge gracefully
    console.error('[Support Email Error]', err.message);
    res.json({ message: 'Support request received' });
  }
};
