// src/tests/rewards.test.js
require('dotenv').config();
const request = require('supertest');
const { app, server } = require('../app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

// Mock email sending to prevent actual email attempts
jest.mock('../utils/sendEmail', () => jest.fn(() => Promise.resolve()));

let csrfToken;
let csrfCookie;

beforeAll(async () => {
  try {
    // Delete referrals first, then users to respect foreign key constraints
    await prisma.referrals.deleteMany();
    // Check for any other tables that might have foreign key relationships
    await prisma.reward?.deleteMany().catch(e => console.log('No rewards table or already empty'));
    await prisma.user.deleteMany();
    
    // Get CSRF token first
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
    csrfCookie = csrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
  } catch (err) {
    console.error('Setup error:', err);
  }
}, 10000);

beforeEach(async () => {
  try {
    // Clear both tables before each test
    await prisma.referrals.deleteMany();
    // Check for any other tables that might have foreign key relationships
    await prisma.reward?.deleteMany().catch(e => console.log('No rewards table or already empty'));
    await prisma.user.deleteMany();
    
    // Get fresh CSRF token for each test
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
    csrfCookie = csrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
    
    // Create a test user for tests that need an existing user
    await request(app)
      .post('/api/register')
      .set('Cookie', csrfCookie)
      .set('x-csrf-token', csrfToken)
      .send({ email: 'test@example.com', username: 'testuser', password: 'Password123' });
    
    // Get fresh CSRF token after registration
    const newCsrfRes = await request(app).get('/api/csrf-token');
    csrfToken = newCsrfRes.body.csrfToken;
    csrfCookie = newCsrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
  } catch (err) {
    console.error('BeforeEach error:', err);
  }
}, 10000);

afterAll(async () => {
  try {
    await prisma.referrals.deleteMany();
    await prisma.reward?.deleteMany().catch(e => console.log('No rewards table or already empty'));
    await prisma.user.deleteMany();
    await prisma.$disconnect();
    server.close();
  } catch (err) {
    console.error('Cleanup error:', err);
  }
}, 10000);

describe('API Endpoints', () => {
  let userToken;
  let authCookie;

  test('POST /api/register - Successful registration', async () => {
    try {
      // Get fresh CSRF token for this test
      const csrfRes = await request(app).get('/api/csrf-token');
      csrfToken = csrfRes.body.csrfToken;
      csrfCookie = csrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
      
      // Clear any existing user with this email first to prevent conflicts
      await prisma.user.deleteMany({
        where: { email: 'newuser@example.com' }
      });
      
      const res = await request(app)
        .post('/api/register')
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
        .send({ email: 'newuser@example.com', username: 'newuser', password: 'Password123' });
      
      // Log response for debugging if needed
      if (res.status !== 201) {
        console.log('Registration failed with status:', res.status);
        console.log('Response body:', res.body);
      }
        
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.headers['set-cookie']).toBeDefined();
      
      // Update CSRF cookie if provided
      const updatedCsrfCookie = res.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
      if (updatedCsrfCookie) {
        csrfCookie = updatedCsrfCookie;
      }
    } catch (err) {
      console.error('Registration test error:', err);
      throw err;
    }
  }, 10000);

  test('POST /api/login - Successful login', async () => {
    try {
      const csrfRes = await request(app).get('/api/csrf-token');
      csrfToken = csrfRes.body.csrfToken;
      csrfCookie = csrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
      
      const res = await request(app)
        .post('/api/login')
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
        .send({ identifier: 'testuser', password: 'Password123' });
      
      // Log response for debugging
      if (res.status !== 200) {
        console.log('Login failed with status:', res.status);
        console.log('Response body:', res.body);
      }
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      
      const cookies = res.headers['set-cookie'];
      const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
      userToken = tokenCookie ? tokenCookie.split(';')[0].split('=')[1] : null;
      authCookie = tokenCookie;
      
      // Update CSRF cookie if provided
      const updatedCsrfCookie = res.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
      if (updatedCsrfCookie) {
        csrfCookie = updatedCsrfCookie;
      }
    } catch (err) {
      console.error('Login test error:', err);
      throw err;
    }
  }, 90000);

  test('GET /api/referrals - Fetch referrals', async () => {
    try {
      const csrfRes = await request(app).get('/api/csrf-token');
      csrfToken = csrfRes.body.csrfToken;
      csrfCookie = csrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
      
      // Login to get a token first
      const loginRes = await request(app)
        .post('/api/login')
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
        .send({ identifier: 'testuser', password: 'Password123' });
      
      const cookies = loginRes.headers['set-cookie'];
      const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
      
      // Update CSRF token after login
      const newCsrfRes = await request(app).get('/api/csrf-token');
      const newCsrfCookie = newCsrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
      
      // Create referrer with referral code
      const referrer = await prisma.user.create({
        data: {
          email: 'referrer@example.com',
          username: 'referrer',
          password_hash: await bcrypt.hash('Password123', 10),
          referral_code: 'REF12345',
        },
      });

      // Register a new user with the referral code
      await request(app)
        .post('/api/register')
        .set('Cookie', newCsrfCookie)
        .set('x-csrf-token', newCsrfRes.body.csrfToken)
        .send({
          email: 'referred@example.com',
          username: 'referred',
          password: 'Password123',
          referral_code: 'REF12345',
        });
      
      // Get fresh CSRF token for the final request
      const finalCsrfRes = await request(app).get('/api/csrf-token');
      const finalCsrfCookie = finalCsrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
      
      // Test getting referrals with token and CSRF cookie
      const res = await request(app)
        .get('/api/referrals')
        .set('Cookie', [tokenCookie, finalCsrfCookie]);
        
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
    } catch (err) {
      console.error('Fetch referrals test error:', err);
      throw err;
    }
  }, 10000);
  
  test('GET /api/referral-stats - Fetch stats', async () => {
    try {
      const csrfRes = await request(app).get('/api/csrf-token');
      csrfToken = csrfRes.body.csrfToken;
      csrfCookie = csrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
      
      // Login to get a token first
      const loginRes = await request(app)
        .post('/api/login')
        .set('Cookie', csrfCookie)
        .set('x-csrf-token', csrfToken)
        .send({ identifier: 'testuser', password: 'Password123' });
      
      const cookies = loginRes.headers['set-cookie'];
      const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
      
      // Get fresh CSRF token
      const finalCsrfRes = await request(app).get('/api/csrf-token');
      const finalCsrfCookie = finalCsrfRes.headers['set-cookie'].find(c => c.startsWith('csrfToken='));
      
      const res = await request(app)
        .get('/api/referral-stats')
        .set('Cookie', [tokenCookie, finalCsrfCookie]);
        
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('successful_referrals');
    } catch (err) {
      console.error('Fetch stats test error:', err);
      throw err;
    }
  }, 10000);
});