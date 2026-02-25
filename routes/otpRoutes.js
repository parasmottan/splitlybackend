import express from 'express';
import rateLimit from 'express-rate-limit';
import { generateAndSendOtp } from '../controllers/otpController.js';

const router = express.Router();

// Rate limiting for OTP resend: max 3 requests per 5 minutes
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3,
  message: { message: 'Too many resend attempts. Please wait 5 minutes.' }
});

router.post('/resend-otp', otpLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    await generateAndSendOtp(email);
    res.status(200).json({ success: true, message: 'OTP resent successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
