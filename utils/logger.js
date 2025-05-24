const fs = require('fs');
const path = require('path');
const config = require('../config/config.json');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir);
  } catch (err) {
    console.error('Could not create logs directory:', err);
  }
}

/**
 * Simple logger utility
 */
const logger = {
  /**
   * Log levels
   */
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  },
  
  /**
   * Get current timestamp
   */
  timestamp: () => {
    return new Date().toISOString();
  },
  
  /**
   * Write log to console and file
   */
  log: (level, message) => {
    // Only log if the level is appropriate
    if (logger.levels[level] <= logger.levels[config.logLevel || 'info']) {
      const logMessage = `[${logger.timestamp()}] [${level.toUpperCase()}] ${message}`;
      
      // Log to console
      console.log(logMessage);
      
      // Log to file
      try {
        const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(logFile, logMessage + '\n');
      } catch (err) {
        console.error('Could not write to log file:', err);
      }
    }
  },
  
  /**
   * Log an error
   */
  logError: (err, ctx = null) => {
    let message = err;
    if (err instanceof Error) {
      message = err.stack || err.message;
    }
    
    let contextInfo = '';
    if (ctx) {
      const { from, chat } = ctx;
      contextInfo = ` | User: ${from?.username || from?.id || 'Unknown'} | Chat: ${chat?.title || chat?.id || 'Unknown'}`;
    }
    
    logger.log('error', `${message}${contextInfo}`);
  },
  
  /**
   * Log a warning
   */
  logWarning: (message) => {
    logger.log('warn', message);
  },
  
  /**
   * Log information
   */
  logInfo: (message) => {
    logger.log('info', message);
  },
  
  /**
   * Log a debug message
   */
  logDebug: (message) => {
    logger.log('debug', message);
  },
  
  /**
   * Log a command execution
   */
  logCommand: (ctx, command) => {
    const { from, chat } = ctx;
    const username = from?.username || from?.id || 'Unknown';
    const chatTitle = chat?.title || chat?.id || 'Unknown';
    
    logger.log('info', `Command: /${command} | User: ${username} | Chat: ${chatTitle}`);
  },
  
  /**
   * Log a message processing event
   */
  logMessage: (message) => {
    logger.log('info', message);
  },
  
  /**
   * Log a user event
   */
  logEvent: (message) => {
    logger.log('info', message);
  },
  
  /**
   * Log general bot action
   */
  logAction: (ctx) => {
    // Only log in debug mode to avoid excessive logging
    if (config.logLevel === 'debug') {
      const { from, chat, message, callbackQuery, inlineQuery } = ctx;
      
      let actionType = 'Unknown action';
      if (message) {
        actionType = 'Message';
      } else if (callbackQuery) {
        actionType = 'Callback';
      } else if (inlineQuery) {
        actionType = 'Inline query';
      }
      
      const username = from?.username || from?.id || 'Unknown';
      const chatTitle = chat?.title || chat?.id || 'Unknown';
      
      logger.log('debug', `${actionType} | User: ${username} | Chat: ${chatTitle}`);
    }
  }
};

module.exports = logger;
