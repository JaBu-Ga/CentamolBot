const { URL } = require('url');
const config = require('../config/config.json');
const logger = require('../utils/logger');

/**
 * Middleware to filter out links that are not from allowed domains
 */
module.exports = async (ctx, next) => {
  // Skip middleware for commands and if not a message
  if (!ctx.message || ctx.message.entities?.some(entity => entity.type === 'bot_command')) {
    return next();
  }

  // Check if message contains text
  if (ctx.message.text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = ctx.message.text.match(urlRegex);

    if (matches) {
      let hasBlockedLink = false;

      for (const match of matches) {
        try {
          const url = new URL(match);
          const domain = url.hostname.replace('www.', '');
          
          // Check if domain is allowed
          const isAllowed = config.allowedDomains.some(allowed => 
            domain === allowed || domain.endsWith(`.${allowed}`)
          );

          if (!isAllowed) {
            hasBlockedLink = true;
            logger.logMessage(`Blocked link from ${ctx.from.username || ctx.from.id}: ${match}`);
            break;
          }
        } catch (err) {
          logger.logError(err, ctx);
        }
      }

      if (hasBlockedLink) {
        // Delete message if configured to do so
        if (config.deleteMessages) {
          try {
            await ctx.deleteMessage();
          } catch (err) {
            logger.logError(`Failed to delete message: ${err.message}`, ctx);
          }
        }

        // Warn user if configured to do so
        if (config.warnUser) {
          await ctx.reply(
            `@${ctx.from.username || ctx.from.id}, в этой группе разрешены только ссылки на YouTube и TikTok.`,
            { reply_to_message_id: ctx.message.message_id }
          );
        }
        
        return; // Don't proceed to next middleware
      }
    }
  }

  return next();
};
