// src/routes/rewards.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { cacheMiddleware, clearUserCache } = require('../middleware/cache');

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/rewards - Get user's rewards with caching
router.get('/rewards', auth, cacheMiddleware(300), async (req, res, next) => {
  try {
    const rewards = await prisma.reward.findMany({
      where: { user_id: req.userId },
      orderBy: { created_at: 'desc' }
    });
    
    const totalRewards = rewards.reduce((sum, reward) => sum + reward.amount, 0);
    
    res.json({
      totalRewards,
      rewards
    });
  } catch (error) {
    next(error);
  }
});

// Add reward after successful referral (to be used internally)
async function addReferralReward(userId, referredUserId) {
  try {
    // Add reward points to the referrer
    await prisma.reward.create({
      data: {
        user_id: userId,
        amount: 100, // 100 points per successful referral
        description: `Reward for successful referral of user ID ${referredUserId}`
      }
    });
    
    // Update referral status to successful
    await prisma.referrals.updateMany({
        where: {
          referrer_id: userId,
          referred_user_id: referredUserId
        },
        data: { status: 'successful' }
      });
      
    
    // Clear cache for the user since their rewards have changed
    clearUserCache(userId);
    
    return true;
  } catch (error) {
    console.error('Error adding reward:', error);
    return false;
  }
}

module.exports = { router, addReferralReward };