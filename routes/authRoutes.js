import express from 'express';
import { registerInitiate, verifyOtp, login, refreshToken, logout, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register-initiate', registerInitiate);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
