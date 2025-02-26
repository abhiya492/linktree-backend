// src/tests/prisma-mock.js
const { PrismaClient } = require('@prisma/client');
const { mockDeep, mockReset } = require('jest-mock-extended');

// Mock Prisma client for tests
const prisma = mockDeep();
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prisma),
}));

beforeEach(() => {
  mockReset(prisma);
});

module.exports = { prisma };