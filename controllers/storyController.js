import Story from '../models/Story.js';
import Group from '../models/Group.js';

// GET /api/stories — fetch all active stories from users in my groups (including self)
export const getStories = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all groups the current user belongs to
    const myGroups = await Group.find({ 'members.user': userId }).select('members');

    // Collect all unique member IDs including self
    const memberIds = new Set();
    memberIds.add(userId.toString());
    for (const group of myGroups) {
      for (const m of group.members) {
        memberIds.add(m.user.toString());
      }
    }

    // Fetch active stories from all these members
    const stories = await Story.find({
      author: { $in: [...memberIds] },
      expiresAt: { $gt: new Date() },
    })
      .populate('author', 'name email')
      .populate('viewers.user', 'name')
      .sort({ createdAt: -1 });

    // Group by author
    const grouped = {};
    for (const story of stories) {
      const uid = story.author._id.toString();
      if (!grouped[uid]) {
        grouped[uid] = {
          userId: uid,
          userName: story.author.name,
          stories: [],
        };
      }
      grouped[uid].stories.push({
        id: story._id,
        text: story.text,
        bg: story.bg,
        fontStyle: story.fontStyle,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        viewerCount: story.viewers.length,
        // Only expose viewer names to the story author
        viewers: story.author._id.toString() === userId.toString()
          ? story.viewers.map(v => ({ name: v.user?.name || 'Someone', viewedAt: v.viewedAt }))
          : [],
      });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/stories — create a new story
export const createStory = async (req, res) => {
  try {
    const { text, bg, fontStyle, durationMs } = req.body;

    if (!text || !text.trim()) return res.status(400).json({ message: 'Text is required' });
    if (!bg) return res.status(400).json({ message: 'Background is required' });

    const duration = Math.min(Math.max(parseInt(durationMs) || 3600000, 60000), 86400000);
    const expiresAt = new Date(Date.now() + duration);

    const story = await Story.create({
      author: req.user._id,
      text: text.trim(),
      bg,
      fontStyle: fontStyle || 'sans',
      expiresAt,
    });

    await story.populate('author', 'name email');

    res.status(201).json({
      id: story._id,
      userId: story.author._id.toString(),
      userName: story.author.name,
      text: story.text,
      bg: story.bg,
      fontStyle: story.fontStyle,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      viewerCount: 0,
      viewers: [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/stories/:id/view — mark a story as viewed by the current user
export const markStoryViewed = async (req, res) => {
  try {
    const userId = req.user._id;
    const story = await Story.findById(req.params.id);

    if (!story) return res.status(404).json({ message: 'Story not found' });

    // Don't count the author viewing their own story
    if (story.author.toString() === userId.toString()) {
      return res.json({ message: 'Author view ignored' });
    }

    // Only add if not already viewed
    const alreadyViewed = story.viewers.some(v => v.user.toString() === userId.toString());
    if (!alreadyViewed) {
      story.viewers.push({ user: userId, viewedAt: new Date() });
      await story.save();
    }

    res.json({ viewerCount: story.viewers.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/stories/:id — delete own story
export const deleteStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) return res.status(404).json({ message: 'Story not found' });
    if (story.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await story.deleteOne();
    res.json({ message: 'Story deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
