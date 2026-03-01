import express from 'express';
import {
  updateProfile,
  changePassword,
  deleteAccount,
  updateNotificationPrefs,
  getFullProfile,
  sendSupportMessage,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET  /api/user/me     — full profile including notificationPrefs
router.get('/me', protect, getFullProfile);

// PATCH /api/user/profile  — update name
router.patch('/profile', protect, updateProfile);

// PATCH /api/user/password  — change password
router.patch('/password', protect, changePassword);

// DELETE /api/user  — delete account
router.delete('/', protect, deleteAccount);

// PATCH /api/user/notifications  — update notification prefs
router.patch('/notifications', protect, updateNotificationPrefs);

// POST /api/user/support  — send support message
router.post('/support', protect, sendSupportMessage);

export default router;
