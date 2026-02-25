import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '0s' } // TTL index: delete when expiresAt is reached
  },
  attempts: {
    type: Number,
    default: 0
  },
  resendCount: {
    type: Number,
    default: 0
  },
  lastResendTime: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Hash OTP before saving
otpSchema.pre('save', async function (next) {
  if (!this.isModified('otp')) return next();
  const salt = await bcrypt.genSalt(10);
  this.otp = await bcrypt.hash(this.otp, salt);
  next();
});

otpSchema.methods.compareOtp = async function (candidateOtp) {
  return bcrypt.compare(candidateOtp, this.otp);
};

export default mongoose.model('Otp', otpSchema);
