const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const generateReferralCode = require('../utils/generateReferralCode');
const sendEmail = require('../utils/sendEmail');
const auth = require('../middleware/auth');
const { addReferralReward } = require('./rewards');
const { cacheMiddleware, clearUserCache } = require('../middleware/cache');

const prisma = new PrismaClient();
const router = express.Router();

// POST /api/register
router.post(
  '/register',
  [
    body('email').isEmail().withMessage('Invalid email format'),
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
    body('referral_code').optional(),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, username, password, referral_code } = req.body;

    try {
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] },
      });
      if (existingUser) {
        return res.status(409).json({ 
          message: `${existingUser.email === email ? 'Email' : 'Username'} already in use` 
        });
      }

      const password_hash = await bcrypt.hash(password, 10);
      const newReferralCode = await generateReferralCode();

      const user = await prisma.user.create({
        data: { email, username, password_hash, referral_code: newReferralCode },
      });

      // Handle referral if referral code was provided
      if (referral_code) {
        const referrer = await prisma.user.findUnique({ where: { referral_code } });
        if (referrer) {
          // Create the referral record
          await prisma.referrals.create({
            data: {
              referrer_id: referrer.id,
              referred_user_id: user.id,
              status: 'pending',  // Will be updated to successful after verification
            },
          });
          
          // Send welcome email mentioning the referral
          await sendEmail(
            email,
            'Welcome to our platform!',
            `Hi ${username},\n\nWelcome to our platform! You were referred by user ${referrer.username}.\n\nGet started by setting up your profile.`
          );
          
          // Add reward to the referrer
          await addReferralReward(referrer.id, user.id);
          
          // Clear cache for the referrer since their referrals have changed
          clearUserCache(referrer.id);
          
        } else {
          // Invalid referral code - still create the user but log the issue
          console.warn(`User registered with invalid referral code: ${referral_code}`);
        }
      } else {
        // Send standard welcome email
        await sendEmail(
          email, 
          'Welcome to our platform!',
          `Hi ${username},\n\nWelcome to our platform! Get started by setting up your profile.`
        );
      }

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      
      res.status(201).json({ 
        id: user.id, 
        username, 
        email,
        referralCode: newReferralCode,
        message: 'Registration successful'
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/login
router.post(
  '/login',
  [
    body('identifier').notEmpty().withMessage('Email or username required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { identifier, password } = req.body;

    try {
      const user = await prisma.user.findFirst({
        where: { OR: [{ email: identifier }, { username: identifier }] },
      });
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
      res.json({ id: user.id, username: user.username, email: user.email });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/logout
router.post('/logout', auth, (req, res) => {
  // Clear the user's cache on logout
  clearUserCache(req.userId);
  res.clearCookie('token');
  res.json({ message: 'Successfully logged out' });
});

// POST /api/forgot-password
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Invalid email format')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.json({ message: 'If the email exists, a reset link has been sent' });
      }

      const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
      const resetLink = `https://yourdomain.com/reset-password?token=${resetToken}`;
      await sendEmail(email, 'Password Reset', `Click here to reset your password: ${resetLink}`);
      res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/reset-password
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token required'),
    body('new_password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { token, new_password } = req.body;

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const password_hash = await bcrypt.hash(new_password, 10);
      await prisma.user.update({
        where: { id: decoded.id },
        data: { password_hash },
      });
      
      // Clear user cache after password reset
      clearUserCache(decoded.id);
      
      res.json({ message: 'Password reset successful' });
    } catch (error) {
      if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }
      next(error);
    }
  }
);

// GET /api/referrals (Protected) with caching
router.get('/referrals', auth, cacheMiddleware(300), async (req, res, next) => {
  try {
    const referrals = await prisma.referrals.findMany({
      where: { referrer_id: req.userId },
      include: { referred_user: { select: { username: true, email: true } } },
    });
    res.json(referrals.map(r => ({
      username: r.referred_user.username,
      email: r.referred_user.email,
      date_referred: r.date_referred,
      status: r.status,
    })));
  } catch (error) {
    next(error);
  }
});

// GET /api/referral-stats (Protected) with caching
router.get('/referral-stats', auth, cacheMiddleware(300), async (req, res, next) => {
  try {
    const successfulCount = await prisma.referrals.count({
      where: { referrer_id: req.userId, status: 'successful' },
    });
    res.json({ successful_referrals: successfulCount });
  } catch (error) {
    next(error);
  }
});

module.exports = router;