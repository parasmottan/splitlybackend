import express from 'express';
import { getStories, createStory, deleteStory } from '../controllers/storyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET  /api/stories — all active stories from my group members
router.get('/', protect, getStories);

// POST /api/stories — post a new story
router.post('/', protect, createStory);

// DELETE /api/stories/:id — delete own story
router.delete('/:id', protect, deleteStory);

export default router;
