import mongoose from 'mongoose';

const settlementSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  }
}, { timestamps: true });

settlementSchema.index({ groupId: 1 });
settlementSchema.index({ fromUser: 1 });
settlementSchema.index({ toUser: 1 });

export default mongoose.model('Settlement', settlementSchema);
