import jwt from 'jsonwebtoken';
import User from '../models/User.js';

import { generateAndSendOtp, verifyOtpCode } from './otpController.js';

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/register-initiate
export const registerInitiate = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    console.log(`[Auth] Initiation request for: ${email}`);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`[Auth] Email already exists: ${email}`);
      return res.status(400).json({ message: 'Email already registered' });
    }

    console.log(`[Auth] Sending OTP to: ${email}`);
    // Generate and send OTP
    await generateAndSendOtp(email);
    console.log(`[Auth] OTP sent successfully to: ${email}`);

    res.status(200).json({ success: true, message: 'Verification code sent to email' });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/verify-otp
export const verifyOtp = async (req, res, next) => {
  try {
    const { name, email, password, otp } = req.body;

    if (!name || !email || !password || !otp) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // 1. Verify OTP
    try {
      await verifyOtpCode(email, otp);
    } catch (otpErr) {
      return res.status(400).json({ message: otpErr.message });
    }

    // 2. Create User
    const user = await User.create({ name, email, password });

    // 4. Issue Tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      },
      accessToken
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/register
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      },
      accessToken
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar
      },
      accessToken
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/refresh
export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'No refresh token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const accessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
};

// POST /api/auth/logout
export const logout = async (req, res) => {
  res.cookie('refreshToken', '', {
    httpOnly: true,
    expires: new Date(0)
  });
  res.json({ message: 'Logged out' });
};

// GET /api/auth/me
export const getMe = async (req, res, next) => {
  try {
    res.json({
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
};
