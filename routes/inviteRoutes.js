import express from 'express';
import {
  inviteByEmails,
  verifyInvite,
  acceptInvite,
  getPendingInvites,
  cancelInvite
} from '../controllers/inviteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Group specific invites
router.post('/groups/:id/invite', protect, inviteByEmails);
router.get('/groups/:id/invites', protect, getPendingInvites);
router.delete('/invites/:inviteId', protect, cancelInvite);

// Direct invite link handling
router.get('/token/:token', verifyInvite);
router.post('/accept', protect, acceptInvite);

export default router;
