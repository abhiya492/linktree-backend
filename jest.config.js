// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000, // Increased timeout for database operations
  setupFilesAfterEnv: ['./src/tests/setup.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Run tests serially in the current process to avoid port conflicts
  runInBand: true,
  // Add more detailed console output
  verbose: true,
};