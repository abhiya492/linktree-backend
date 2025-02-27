// src/tests/setup.js
require('dotenv').config({ path: '.env.test' });
const { cleanupDatabase } = require('./test-utils');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

beforeAll(async () => {
  // Connect to test database
  try {
    await prisma.$connect();
    console.log('Connected to test database');
    
    // Clean it
    await cleanupDatabase();
  } catch (error) {
    console.error('Test database connection error:', error);
    throw error;
  }
});

afterAll(async () => {
  // Additional cleanup
  try {
    await cleanupDatabase();
    await prisma.$disconnect();
    console.log('Disconnected from test database');
  } catch (error) {
    console.error('Test database disconnect error:', error);
  }
});