import mongoose from 'mongoose';

const groupInviteSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  invitedEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  inviteToken: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'cancelled'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '0s' } // TTL index for automatic deletion of expired/old invites if desired, but 48h limit is handled by logic too.
  }
}, { timestamps: true });

export default mongoose.model('GroupInvite', groupInviteSchema);
