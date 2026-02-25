import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['owner', 'member'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['trip', 'house', 'project', 'couple', 'other'],
    default: 'trip'
  },
  currency: {
    type: String,
    default: 'INR'
  },
  currencySymbol: {
    type: String,
    default: '₹'
  },
  members: [memberSchema],
  inviteCode: {
    type: String,
    unique: true,
    sparse: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  archived: {
    type: Boolean,
    default: false
  },
  photo: {
    type: String,
    default: ''
  }
}, { timestamps: true });

groupSchema.index({ 'members.user': 1 });

// Generate a random 6-character invite code
groupSchema.pre('save', async function (next) {
  if (!this.inviteCode) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.inviteCode = code;
  }
  next();
});

export default mongoose.model('Group', groupSchema);
