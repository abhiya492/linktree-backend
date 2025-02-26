// jest.config.js
module.exports = {
    testEnvironment: 'node',
    testTimeout: 20000,
    setupFilesAfterEnv: ['./src/tests/setup.js'],
  };
  
  // src/tests/setup.js
  require('dotenv').config({ path: '.env.test' });
  const { cleanupDatabase } = require('./test-utils');
  
  beforeAll(async () => {
    // Connect to test database and clean it
    await cleanupDatabase();
  });
  
  afterAll(async () => {
    // Additional cleanup if needed
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$disconnect();
  });