// src/middleware/csrf.js
const crypto = require('crypto');

function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

function csrfProtection(req, res, next) {
  // Skip for GET, HEAD, OPTIONS requests (they should be idempotent)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const requestToken = req.headers['x-csrf-token'] || req.body._csrf;
  const cookieToken = req.cookies.csrfToken;

  // If tokens don't match, reject the request
  if (!cookieToken || !requestToken || cookieToken !== requestToken) {
    return res.status(403).json({ message: 'CSRF token validation failed' });
  }

  next();
}

module.exports = { generateCSRFToken, csrfProtection };