import express from 'express';
import {
  getNotifications,
  markRead,
  markAllRead,
  sendManualReminder
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getNotifications);
router.patch('/:id/read', protect, markRead);
router.post('/read-all', protect, markAllRead);

// POST /api/notifications/remind
router.post('/remind', protect, sendManualReminder);

// POST /api/notifications/remind-all (System/Testing)
router.post('/remind-all', protect, async (req, res) => {
  try {
    const { triggerSmartReminders } = await import('../services/reminderService.js');
    const count = await triggerSmartReminders();
    res.json({ success: true, nudgesSent: count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
