// Debug utility for color-based console logging
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

// Debug levels
const DEBUG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
  SUCCESS: 'SUCCESS'
};

// Debug configuration
const DEBUG_CONFIG = {
  enabled: process.env.NODE_ENV !== 'production',
  level: process.env.DEBUG_LEVEL || 'INFO',
  showTimestamp: true,
  showRequestId: true,
  maxDataLength: 1000
};

// Get debug level priority
function getLevelPriority(level) {
  const priorities = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    SUCCESS: 4
  };
  return priorities[level] || 0;
}

// Should log based on debug level
function shouldLog(level) {
  if (!DEBUG_CONFIG.enabled) return false;
  const currentPriority = getLevelPriority(DEBUG_CONFIG.level);
  const messagePriority = getLevelPriority(level);
  return messagePriority <= currentPriority;
}

// Format timestamp
function formatTimestamp() {
  if (!DEBUG_CONFIG.showTimestamp) return '';
  const now = new Date();
  return `[${now.toISOString()}] `;
}

// Truncate data for display
function truncateData(data) {
  if (!data) return data;
  const dataStr = JSON.stringify(data);
  if (dataStr.length <= DEBUG_CONFIG.maxDataLength) return data;
  return dataStr.substring(0, DEBUG_CONFIG.maxDataLength) + '...';
}

// Main debug logging function
function debugLog(level, prefix, message, data = null, requestId = null) {
  if (!shouldLog(level)) return;

  const timestamp = formatTimestamp();
  const requestIdStr = requestId && DEBUG_CONFIG.showRequestId ? `[${requestId}] ` : '';
  
  // Get color based on level
  let color = colors.white;
  switch (level) {
    case DEBUG_LEVELS.ERROR:
      color = colors.red;
      break;
    case DEBUG_LEVELS.WARN:
      color = colors.yellow;
      break;
    case DEBUG_LEVELS.INFO:
      color = colors.blue;
      break;
    case DEBUG_LEVELS.DEBUG:
      color = colors.cyan;
      break;
    case DEBUG_LEVELS.SUCCESS:
      color = colors.green;
      break;
  }

  // Format the main log message
  const logMessage = `${color}${colors.bright}${timestamp}${requestIdStr}${prefix}${colors.reset} ${message}`;
  console.log(logMessage);

  // Log data if provided
  if (data) {
    const truncatedData = truncateData(data);
    console.log(`${colors.gray}${truncatedData}${colors.reset}`);
  }
}

// Convenience functions for different debug levels
const debug = {
  // Error logging
  error: (prefix, message, data = null, requestId = null) => {
    debugLog(DEBUG_LEVELS.ERROR, prefix, message, data, requestId);
  },

  // Warning logging
  warn: (prefix, message, data = null, requestId = null) => {
    debugLog(DEBUG_LEVELS.WARN, prefix, message, data, requestId);
  },

  // Info logging
  info: (prefix, message, data = null, requestId = null) => {
    debugLog(DEBUG_LEVELS.INFO, prefix, message, data, requestId);
  },

  // Debug logging
  debug: (prefix, message, data = null, requestId = null) => {
    debugLog(DEBUG_LEVELS.DEBUG, prefix, message, data, requestId);
  },

  // Success logging
  success: (prefix, message, data = null, requestId = null) => {
    debugLog(DEBUG_LEVELS.SUCCESS, prefix, message, data, requestId);
  },

  // Request logging
  request: (method, path, data = null, requestId = null) => {
    debugLog(DEBUG_LEVELS.INFO, '🛒 REQUEST', `${method} ${path}`, data, requestId);
  },

  // Response logging
  response: (method, path, statusCode, data = null, requestId = null) => {
    const level = statusCode >= 400 ? DEBUG_LEVELS.ERROR : DEBUG_LEVELS.SUCCESS;
    const prefix = statusCode >= 400 ? '❌ RESPONSE' : '✅ RESPONSE';
    debugLog(level, prefix, `${method} ${path} (${statusCode})`, data, requestId);
  },

  // Database operations
  db: {
    query: (operation, collection, data = null, requestId = null) => {
      debugLog(DEBUG_LEVELS.DEBUG, '🗄️ DB QUERY', `${operation} on ${collection}`, data, requestId);
    },
    success: (operation, collection, data = null, requestId = null) => {
      debugLog(DEBUG_LEVELS.SUCCESS, '✅ DB SUCCESS', `${operation} on ${collection}`, data, requestId);
    },
    error: (operation, collection, error, requestId = null) => {
      debugLog(DEBUG_LEVELS.ERROR, '❌ DB ERROR', `${operation} on ${collection}: ${error.message}`, { stack: error.stack }, requestId);
    }
  },

  // Authentication operations
  auth: {
    login: (userId, data = null, requestId = null) => {
      debugLog(DEBUG_LEVELS.SUCCESS, '🔐 AUTH LOGIN', `User ${userId} logged in`, data, requestId);
    },
    logout: (userId, requestId = null) => {
      debugLog(DEBUG_LEVELS.INFO, '🚪 AUTH LOGOUT', `User ${userId} logged out`, null, requestId);
    },
    error: (operation, error, requestId = null) => {
      debugLog(DEBUG_LEVELS.ERROR, '❌ AUTH ERROR', `${operation}: ${error.message}`, { stack: error.stack }, requestId);
    }
  },

  // Cart operations
  cart: {
    add: (userId, productId, data = null, requestId = null) => {
      debugLog(DEBUG_LEVELS.INFO, '🛍️ CART ADD', `User ${userId} adding product ${productId}`, data, requestId);
    },
    update: (userId, itemId, data = null, requestId = null) => {
      debugLog(DEBUG_LEVELS.INFO, '🔄 CART UPDATE', `User ${userId} updating item ${itemId}`, data, requestId);
    },
    remove: (userId, itemId, requestId = null) => {
      debugLog(DEBUG_LEVELS.INFO, '🗑️ CART REMOVE', `User ${userId} removing item ${itemId}`, null, requestId);
    },
    clear: (userId, requestId = null) => {
      debugLog(DEBUG_LEVELS.INFO, '🧹 CART CLEAR', `User ${userId} clearing cart`, null, requestId);
    }
  },

  // Product operations
  product: {
    search: (query, data = null, requestId = null) => {
      debugLog(DEBUG_LEVELS.DEBUG, '🔍 PRODUCT SEARCH', `Search query: ${query}`, data, requestId);
    },
    found: (productId, data = null, requestId = null) => {
      debugLog(DEBUG_LEVELS.SUCCESS, '✅ PRODUCT FOUND', `Product ${productId} found`, data, requestId);
    },
    notFound: (productId, requestId = null) => {
      debugLog(DEBUG_LEVELS.WARN, '❌ PRODUCT NOT FOUND', `Product ${productId} not found`, null, requestId);
    }
  },

  // Validation
  validation: {
    error: (errors, data = null, requestId = null) => {
      debugLog(DEBUG_LEVELS.ERROR, '❌ VALIDATION ERROR', 'Request validation failed', { errors, data }, requestId);
    },
    success: (data = null, requestId = null) => {
      debugLog(DEBUG_LEVELS.SUCCESS, '✅ VALIDATION SUCCESS', 'Request validation passed', data, requestId);
    }
  },

  // Performance
  performance: {
    start: (operation, requestId = null) => {
      const startTime = Date.now();
      debugLog(DEBUG_LEVELS.DEBUG, '⏱️ PERF START', `${operation} started`, { startTime }, requestId);
      return startTime;
    },
    end: (operation, startTime, requestId = null) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      debugLog(DEBUG_LEVELS.SUCCESS, '⏱️ PERF END', `${operation} completed in ${duration}ms`, { duration, startTime, endTime }, requestId);
    }
  },

  // Configuration
  config: DEBUG_CONFIG,
  
  // Colors for custom usage
  colors
};

module.exports = debug; 