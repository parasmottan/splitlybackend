import mongoose from 'mongoose';

const storySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true,
  },
  bg: {
    type: String,
    required: true, // CSS gradient string
  },
  fontStyle: {
    type: String,
    enum: ['sans', 'serif', 'script'],
    default: 'sans',
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // MongoDB TTL index
  },
}, { timestamps: true });

export default mongoose.model('Story', storySchema);
