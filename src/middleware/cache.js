// src/middleware/cache.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes default TTL

function cacheMiddleware(ttl = 300) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Create a cache key from the URL and user ID (for user-specific content)
    const userId = req.userId || 'anonymous';
    const key = `${userId}-${req.originalUrl}`;
    
    // Try to get from cache
    const cachedResponse = cache.get(key);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }
    
    // Cache miss - store the original json method
    const originalJson = res.json;
    
    // Override res.json to cache the response before sending
    res.json = function(data) {
      // Store response in cache
      cache.set(key, data, ttl);
      
      // Call the original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// Function to clear user-specific cache entries 
function clearUserCache(userId) {
  // Get all keys
  const keys = cache.keys();
  
  // Filter keys that belong to this user
  const userKeys = keys.filter(key => key.startsWith(`${userId}-`));
  
  // Delete all keys for this user
  userKeys.forEach(key => cache.del(key));
}

module.exports = { cacheMiddleware, clearUserCache };