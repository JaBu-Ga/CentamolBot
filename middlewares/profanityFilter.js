const bannedWords = require('../config/bannedWords.json');
const config = require('../config/config.json');
const logger = require('../utils/logger');

/**
 * Basic profanity filter middleware
 */
module.exports = async (ctx, next) => {
  // Skip middleware for commands and if not a message
  if (!ctx.message || ctx.message.entities?.some(entity => entity.type === 'bot_command')) {
    return next();
  }

  // Check if message contains text
  if (ctx.message.text) {
    const text = ctx.message.text.toLowerCase();
    let hasProfanity = false;
    let censoredText = ctx.message.text;

    // Check for banned words
    for (const word of bannedWords.words) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(text)) {
        hasProfanity = true;
        // Create censored version of the message
        const replacement = bannedWords.replacementChar.repeat(word.length);
        censoredText = censoredText.replace(regex, replacement);
      }
    }

    if (hasProfanity) {
      logger.logMessage(`Detected profanity from ${ctx.from.username || ctx.from.id}: "${ctx.message.text}"`);
      
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
          `@${ctx.from.username || ctx.from.id}, ${bannedWords.message}`,
          { reply_to_message_id: ctx.message.message_id }
        );
        
        // Optionally send censored version
        if (!config.deleteMessages) {
          await ctx.reply(`Отредактированное сообщение: "${censoredText}"`);
        }
      }
      
      return; // Don't proceed to next middleware
    }
  }

  return next();
};
