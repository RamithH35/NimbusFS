import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from './User.js';
import { JWT_SECRET, REFRESH_TOKEN_SECRET } from '../config/env.js';

// Validate email format helper
const isValidEmail = (email) => {
  const emailRegex = /^\S+@\S+\.\S+$/;
  return emailRegex.test(email);
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields (name, email, password) are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  // Password strength check (minimum 8 characters, at least one number)
  if (password.length < 8 || !/\d/.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one number' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // 409 Conflict with generic message
      return res.status(409).json({ error: 'Email is already registered' });
    }

    // Hash password with bcrypt cost factor 12
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      email,
      name,
      passwordHash,
      avatarSeed: 'placeholder', // temporarily set to make schema happy
    });

    // Set avatarSeed to the new user's generated _id
    user.avatarSeed = user._id.toString();
    await user.save();

    return res.status(201).json({
      id: user._id,
      email: user.email,
      name: user.name,
      avatarSeed: user.avatarSeed,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
};

// @desc    Login user & get tokens
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      // Generic invalid credentials message
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Generic invalid credentials message
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Issue short-lived access token (15 mins)
    const accessToken = jwt.sign(
      { userId: user._id, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Issue long-lived refresh token (7 days)
    const refreshToken = jwt.sign(
      { userId: user._id, tokenVersion: user.tokenVersion },
      REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    // Set refresh token as secure, httpOnly, sameSite strict cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatarSeed: user.avatarSeed,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
export const refresh = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ error: 'Token has been revoked or user not found' });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: user._id, tokenVersion: user.tokenVersion },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error('Refresh token error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
};

// @desc    Logout user & invalidate tokens
// @route   POST /api/auth/logout
// @access  Public
export const logout = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (token) {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
      
      // Increment tokenVersion on the user to invalidate all active refresh/access tokens
      await User.findByIdAndUpdate(decoded.userId, { $inc: { tokenVersion: 1 } });
    } catch (error) {
      // Ignore verification errors to allow cookie clearance on expired/invalid tokens
      console.warn('Logout token verification warning:', error.message);
    }
  }

  // Clear cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  return res.status(200).json({ message: 'Successfully logged out' });
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const profile = async (req, res) => {
  // User is already attached by protection middleware
  return res.status(200).json({
    id: req.user._id,
    email: req.user.email,
    name: req.user.name,
    avatarSeed: req.user.avatarSeed,
  });
};
