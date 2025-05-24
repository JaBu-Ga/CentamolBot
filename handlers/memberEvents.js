const config = require('../config/config.json');
const logger = require('../utils/logger');

/**
 * Handlers for member events (joining or leaving the group)
 */
module.exports = {
  /**
   * Handle new members joining the group
   */
  handleNewMember: async (ctx, groupUsers = {}, saveUsers = null) => {
    try {
      const newMembers = ctx.message.new_chat_members;
      
      // Skip if the new member is the bot itself
      if (newMembers.some(member => member.is_bot && member.username === ctx.botInfo.username)) {
        return;
      }
      
      // Сохраняем информацию о новых пользователях
      if (groupUsers && ctx.chat && ctx.chat.id) {
        const chatId = ctx.chat.id.toString();
        
        // Создаем объект для чата, если его еще нет
        if (!groupUsers[chatId]) {
          groupUsers[chatId] = {
            title: ctx.chat.title || `Чат ${chatId}`,
            users: {}
          };
        }
        
        // Добавляем новых пользователей в список
        for (const member of newMembers) {
          if (!member.is_bot) {
            const userId = member.id.toString();
            groupUsers[chatId].users[userId] = {
              id: member.id,
              username: member.username || null,
              first_name: member.first_name || null,
              last_name: member.last_name || null,
              last_active: new Date().toISOString(),
              joined_at: new Date().toISOString()
            };
          }
        }
        
        // Сохраняем данные
        if (typeof saveUsers === 'function') {
          saveUsers();
        }
      }
      
      for (const member of newMembers) {
        const username = member.username || member.first_name || 'New member';
        const welcomeMessage = config.welcomeMessage.replace('{username}', username);
        
        await ctx.reply(welcomeMessage);
        logger.logEvent(`New member joined: ${username}`);
      }
    } catch (err) {
      logger.logError(err, ctx);
    }
  },
  
  /**
   * Handle members leaving the group
   */
  handleLeftMember: async (ctx, groupUsers = {}, saveUsers = null) => {
    try {
      const leftMember = ctx.message.left_chat_member;
      
      // Skip if the left member is the bot itself
      if (leftMember.is_bot && leftMember.username === ctx.botInfo.username) {
        return;
      }
      
      // Отмечаем пользователя как покинувшего группу
      if (groupUsers && ctx.chat && ctx.chat.id) {
        const chatId = ctx.chat.id.toString();
        
        if (groupUsers[chatId] && groupUsers[chatId].users) {
          const userId = leftMember.id.toString();
          
          if (groupUsers[chatId].users[userId]) {
            groupUsers[chatId].users[userId].left_at = new Date().toISOString();
            
            // Сохраняем данные
            if (typeof saveUsers === 'function') {
              saveUsers();
            }
          }
        }
      }
      
      const username = leftMember.username || leftMember.first_name || 'A member';
      const farewellMessage = config.farewellMessage.replace('{username}', username);
      
      await ctx.reply(farewellMessage);
      logger.logEvent(`Member left: ${username}`);
    } catch (err) {
      logger.logError(err, ctx);
    }
  }
};
