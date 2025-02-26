// src/tests/rewards.test.js
require('dotenv').config();
const request = require('supertest');
const { app, server } = require('../app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

let referrerToken;
let referrerUser;
let referredUser;
let csrfToken;

beforeAll(async () => {
  // Clean up database
  await prisma.reward.deleteMany();
  await prisma.referrals.deleteMany();
  await prisma.user.deleteMany();
  
  // Get CSRF token
  const csrfRes = await request(app).get('/api/csrf-token');
  csrfToken = csrfRes.body.csrfToken;
  
  // Create test users
  referrerUser = await prisma.user.create({
    data: {
      email: 'referrer@example.com',
      username: 'referrer',
      password_hash: await bcrypt.hash('password123', 10),
      referral_code: 'TESTREF1',
    },
  });
  
  // Login as referrer to get token
  const res = await request(app)
    .post('/api/login')
    .set('x-csrf-token', csrfToken)
    .send({ identifier: 'referrer', password: 'password123' });
  
  referrerToken = res.headers['set-cookie'][0].split(';')[0].split('=')[1];
}, 10000);

afterAll(async () => {
  await prisma.reward.deleteMany();
  await prisma.referrals.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
  server.close();
}, 10000);

describe('Rewards System', () => {
  test('Registration with referral code creates reward', async () => {
    // Register a new user with referral code
    const res = await request(app)
      .post('/api/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email: 'referred@example.com',
        username: 'referred',
        password: 'Password123',
        referral_code: 'TESTREF1',
      });
    
    expect(res.status).toBe(201);
    referredUser = res.body;
    
    // Verify the referral was created in the database
    const referral = await prisma.referrals.findFirst({
      where: {
        referrer_id: referrerUser.id,
        referred_user_id: referredUser.id,
      },
    });
    
    expect(referral).toBeDefined();
    expect(referral.status).toBe('successful');
    
    // Check if reward was created
    const reward = await prisma.reward.findFirst({
      where: {
        user_id: referrerUser.id,
      },
    });
    
    expect(reward).toBeDefined();
    expect(reward.amount).toBe(100);
  }, 10000);
  
  test('Fetching rewards returns correct data', async () => {
    const res = await request(app)
      .get('/api/rewards')
      .set('Cookie', `token=${referrerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalRewards');
    expect(res.body).toHaveProperty('rewards');
    expect(res.body.totalRewards).toBe(100);
    expect(res.body.rewards.length).toBe(1);
  }, 10000);
  
  test('Referral stats include successful referrals', async () => {
    const res = await request(app)
      .get('/api/referral-stats')
      .set('Cookie', `token=${referrerToken}`);
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('successful_referrals');
    expect(res.body.successful_referrals).toBe(1);
  }, 10000);
});