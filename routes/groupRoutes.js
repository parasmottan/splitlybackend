import express from 'express';
import {
  createGroup,
  getGroups,
  getGroup,
  joinGroup,
  updateGroup,
  archiveGroup,
  deleteGroup,
  leaveGroup,
  getInviteCode
} from '../controllers/groupController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getGroups).post(createGroup);
router.post('/join', joinGroup);
router.route('/:id').get(getGroup).put(updateGroup).delete(deleteGroup);
router.put('/:id/archive', archiveGroup);
router.put('/:id/leave', leaveGroup);
router.get('/:id/invite-code', getInviteCode);

export default router;
