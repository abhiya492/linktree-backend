// src/tests/security.test.js
require('dotenv').config();
const request = require('supertest');
const { app, server } = require('../app');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let csrfToken;
let userCookie;

beforeAll(async () => {
  await prisma.user.deleteMany();
  
  // First get CSRF token
  const csrfRes = await request(app).get('/api/csrf-token');
  csrfToken = csrfRes.body.csrfToken;
  
  // Create a test user with CSRF token
  await request(app)
    .post('/api/register')
    .set('x-csrf-token', csrfToken)
    .send({
      email: 'security@example.com',
      username: 'securitytest',
      password: 'Password123',
    });
  
  // Login with CSRF token
  const loginRes = await request(app)
    .post('/api/login')
    .set('x-csrf-token', csrfToken)
    .send({
      identifier: 'securitytest',
      password: 'Password123',
    });
  
  userCookie = loginRes.headers['set-cookie'];
}, 10000);

afterAll(async () => {
  await prisma.user.deleteMany();
  await prisma.$disconnect();
  server.close();
}, 10000);

describe('Security Tests', () => {
  test('CSRF Protection prevents requests without token', async () => {
    const res = await request(app)
      .post('/api/reset-password')
      .set('Cookie', userCookie)
      .send({
        token: 'test-token',
        new_password: 'NewPassword123',
      });
    
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('CSRF token validation failed');
  }, 10000);
  
  test('Rate limiting prevents too many requests', async () => {
    // Make sure we have a fresh CSRF token
    const csrfRes = await request(app).get('/api/csrf-token');
    const freshCsrfToken = csrfRes.body.csrfToken;
    
    // Send multiple requests to a rate-limited endpoint
    const requests = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/forgot-password')
        .set('x-csrf-token', freshCsrfToken)
        .send({ email: `test${i}@example.com` });
      requests.push(res);
    }
    
    // The 6th request should be rate limited
    expect(requests[5].status).toBe(429);
    expect(requests[5].body).toHaveProperty('message');
    expect(requests[5].body.message).toContain('Too many requests');
  }, 20000);
  
  test('Protected routes require authentication', async () => {
    const res = await request(app)
      .get('/api/referrals')
      .set('x-csrf-token', csrfToken);
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  }, 10000);
  
  test('Invalid JWT tokens are rejected', async () => {
    const res = await request(app)
      .get('/api/referrals')
      .set('Cookie', ['token=invalid.token.here'])
      .set('x-csrf-token', csrfToken);
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  }, 10000);
});