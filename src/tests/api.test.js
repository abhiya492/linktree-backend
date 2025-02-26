require('dotenv').config();
const request = require('supertest');
const { app, server } = require('../app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

let csrfToken;
let csrfCookieValue;

beforeAll(async () => {
  // Delete referrals first, then users to respect foreign key constraints
  await prisma.referrals.deleteMany();
  await prisma.user.deleteMany();
  
  // Get CSRF token first
  const csrfRes = await request(app).get('/api/csrf-token');
  csrfToken = csrfRes.body.csrfToken;
  const csrfCookie = csrfRes.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
  csrfCookieValue = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : null;
}, 10000);

beforeEach(async () => {
  // Clear both tables before each test
  await prisma.referrals.deleteMany();
  await prisma.user.deleteMany();
  
  // Get fresh CSRF token for each test
  const csrfRes = await request(app).get('/api/csrf-token');
  csrfToken = csrfRes.body.csrfToken;
  const csrfCookie = csrfRes.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
  csrfCookieValue = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : null;
  
  // Create a test user for tests that need an existing user
  await request(app)
    .post('/api/register')
    .set('x-csrf-token', csrfToken)
    .send({ email: 'test@example.com', username: 'testuser', password: 'password123' });
}, 10000);

afterAll(async () => {
  await prisma.referrals.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
  server.close();
}, 10000);

describe('API Endpoints', () => {
  let userToken;

  test('POST /api/register - Successful registration', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
    csrfCookieValue = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : null;
    
    const res = await request(app)
      .post('/api/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'newuser@example.com', username: 'newuser', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.headers['set-cookie']).toBeDefined();
  }, 10000);

  test('POST /api/login - Successful login', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
    csrfCookieValue = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : null;
    
    const res = await request(app)
      .post('/api/login')
      .set('x-csrf-token', csrfToken)
      .send({ identifier: 'testuser', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    
    const cookies = res.headers['set-cookie'];
    const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
    userToken = tokenCookie ? tokenCookie.split(';')[0].split('=')[1] : null;
  }, 10000);

  test('GET /api/referrals - Fetch referrals', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
    csrfCookieValue = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : null;
    
    // Login to get a token first
    const loginRes = await request(app)
      .post('/api/login')
      .set('x-csrf-token', csrfToken)
      .send({ identifier: 'testuser', password: 'password123' });
    
    const cookies = loginRes.headers['set-cookie'];
    const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
    const token = tokenCookie ? tokenCookie.split(';')[0].split('=')[1] : null;
    
    // Create referrer with referral code
    const referrer = await prisma.user.create({
      data: {
        email: 'referrer@example.com',
        username: 'referrer',
        password_hash: await bcrypt.hash('password123', 10),
        referral_code: 'REF12345',
      },
    });

    // Register a new user with the referral code
    await request(app)
      .post('/api/register')
      .set('x-csrf-token', csrfToken)
      .send({
        email: 'referred@example.com',
        username: 'referred',
        password: 'password123',
        referral_code: 'REF12345',
      });

    // Test getting referrals with token
    const res = await request(app)
      .get('/api/referrals')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  }, 10000);

  test('GET /api/referral-stats - Fetch stats', async () => {
    const csrfRes = await request(app).get('/api/csrf-token');
    csrfToken = csrfRes.body.csrfToken;
    const csrfCookie = csrfRes.headers['set-cookie']?.find(c => c.startsWith('csrfToken='));
    csrfCookieValue = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : null;
    
    // Login to get a token first
    const loginRes = await request(app)
      .post('/api/login')
      .set('x-csrf-token', csrfToken)
      .send({ identifier: 'testuser', password: 'password123' });
    
    const cookies = loginRes.headers['set-cookie'];
    const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
    const token = tokenCookie ? tokenCookie.split(';')[0].split('=')[1] : null;
    
    const res = await request(app)
      .get('/api/referral-stats')
      .set('Cookie', `token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('successful_referrals');
  }, 10000);
});