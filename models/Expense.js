import mongoose from 'mongoose';

const splitSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  }
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: 0
  },
  category: {
    type: String,
    enum: ['food', 'transport', 'groceries', 'entertainment', 'utilities', 'rent', 'travel', 'shopping', 'other'],
    default: 'other'
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  splitType: {
    type: String,
    enum: ['equal', 'custom'],
    default: 'equal'
  },
  splits: [splitSchema]
}, { timestamps: true });

expenseSchema.index({ groupId: 1 });
expenseSchema.index({ paidBy: 1 });

export default mongoose.model('Expense', expenseSchema);
