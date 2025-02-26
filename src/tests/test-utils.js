// src/tests/test-utils.js
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupTestUser(app, userData = {}) {
  // Get CSRF token
  const csrfRes = await request(app).get('/api/csrf-token');
  const csrfToken = csrfRes.body.csrfToken;
  
  // Default test user data
  const defaultUserData = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'Password123',
    ...userData
  };
  
  // Create user
  const registerRes = await request(app)
    .post('/api/register')
    .set('x-csrf-token', csrfToken)
    .send(defaultUserData);
  
  // Login to get token
  const loginRes = await request(app)
    .post('/api/login')
    .set('x-csrf-token', csrfToken)
    .send({ 
      identifier: defaultUserData.username, 
      password: defaultUserData.password 
    });
  
  // Extract token from cookie
  const cookies = loginRes.headers['set-cookie'];
  const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
  const token = tokenCookie ? tokenCookie.split(';')[0].split('=')[1] : null;
  
  return {
    user: registerRes.body,
    token,
    csrfToken
  };
}

async function cleanupDatabase() {
  // Delete in proper order to respect foreign key constraints
  await prisma.reward.deleteMany();
  await prisma.referrals.deleteMany();
  await prisma.user.deleteMany();
}

module.exports = {
  setupTestUser,
  cleanupDatabase
};