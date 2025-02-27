const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const userRoutes = require('./routes/users');
const { router: rewardsRouter } = require('./routes/rewards'); // Import rewards router
const cors = require('cors');
const helmet = require('helmet');
const { generateCSRFToken, csrfProtection } = require('./middleware/csrf');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token']
}));

app.use(express.json());
app.use(cookieParser());

// CSRF token endpoint - must come before other middleware so that tests can access it
app.get('/api/csrf-token', (req, res) => {
  // Generate new token if one doesn't exist
  if (!req.cookies.csrfToken) {
    const token = generateCSRFToken();
    res.cookie('csrfToken', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    return res.json({ csrfToken: token });
  }
  res.json({ csrfToken: req.cookies.csrfToken });
});

// Generate CSRF token for all requests
app.use((req, res, next) => {
  if (!req.cookies.csrfToken) {
    const token = generateCSRFToken();
    res.cookie('csrfToken', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
  }
  next();
});

// Rate limiting for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per IP for password reset
  message: { message: 'Too many requests from this IP, please try again later' }
});

const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: { message: 'Too many requests from this IP, please try again later' }
});

app.use('/api/register', standardLimiter);
app.use('/api/login', standardLimiter);
app.use('/api/forgot-password', strictLimiter);
app.use('/api/reset-password', strictLimiter);

// Apply CSRF protection to non-GET routes
app.use(csrfProtection);

// Routes
app.use('/api', userRoutes);
app.use('/api', rewardsRouter); // Add rewards routes

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    message: statusCode === 500 ? 'Internal server error' : err.message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  module.exports = { app, server };
} else {
  // For tests, export the app without starting the server
  // This allows tests to control when/if the server starts
  const server = {
    close: () => {} // Mock close method for tests
  };
  module.exports = { app, server };
}