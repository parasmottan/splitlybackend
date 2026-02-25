import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  type: {
    type: String,
    enum: ['reminder', 'invite', 'system', 'settlement'],
    default: 'system'
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  metadata: {
    inviterName: String,
    amount: Number,
    currency: String,
    settlementId: mongoose.Schema.Types.ObjectId
  }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
