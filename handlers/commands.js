const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");
const nicknamesPath = path.join(__dirname, "../data/nicknames.json");

// Сохранение наград
function saveAwards(awards) {
  try {
    fs.writeFileSync(awardsPath, JSON.stringify(awards, null, 2));
  } catch (err) {
    console.error("Ошибка при сохранении наград:", err);
  }
}
// Функция для загрузки никнеймов
function loadNicknames() {
  try {
    if (fs.existsSync(nicknamesPath)) {
      const data = fs.readFileSync(nicknamesPath, "utf8");
      return JSON.parse(data);
    }
    return {};
  } catch (err) {
    console.error("Ошибка при загрузке никнеймов:", err);
    return {};
  }
}

// Функция для сохранения никнеймов
function saveNicknames(nicknames) {
  try {
    fs.writeFileSync(nicknamesPath, JSON.stringify(nicknames, null, 2));
  } catch (err) {
    console.error("Ошибка при сохранении никнеймов:", err);
  }
}

module.exports = {
  /**
   * Middleware для фильтрации ссылок (кроме YouTube и TikTok)
   */
  filterLinks: async (ctx, next) => {
    try {
      if (!ctx.message || !ctx.message.text || ctx.message.from.is_bot) {
        return next();
      }

      try {
        const member = await ctx.getChatMember(ctx.from.id);
        if (member.status === "creator" || member.status === "administrator") {
          return next();
        }
      } catch (e) {
        console.error("Ошибка при проверке прав:", e);
      }

      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = ctx.message.text.match(urlRegex);

      if (!urls || urls.length === 0) return next();

      const allowedDomains = [
        "youtube.com",
        "youtu.be",
        "tiktok.com",
        "vm.tiktok.com",
      ];

      for (const url of urls) {
        try {
          const domain = new URL(url).hostname.replace("www.", "");
          if (!allowedDomains.some((allowed) => domain.includes(allowed))) {
            await ctx.deleteMessage();
            await ctx.replyWithHTML(
              `❌ <b>${ctx.from.first_name}, ссылки запрещены!</b>\n` +
                `Можно делиться только ссылками на YouTube и TikTok.\n` +
                `Сообщение было удалено.`,
            );
            logger.logAction(ctx, `Удалено сообщение со ссылкой: ${url}`);
            return;
          }
        } catch (e) {
          continue;
        }
      }
      return next();
    } catch (err) {
      logger.logError(err, ctx);
      return next();
    }
  },

  tagAll: async (ctx) => {
    try {
      // Проверяем права
      const member = await ctx.getChatMember(ctx.from.id);
      if (member.status !== "creator" && member.status !== "administrator") {
        await ctx.reply("❌ Эта команда доступна только администраторам.");
        return;
      }

      // Получаем ID чата
      const chatId = ctx.chat.id;

      // Создаем список для упоминаний
      let mentions = [];
      let processedMembers = 0;
      let limit = 50; // Лимит для теста

      // Получаем участников (метод getChatMembersCount + итерация)
      const membersCount = await ctx.getChatMembersCount();

      // Формируем текст
      let messageText = "🔔 <b>Упоминание всех участников</b>\n\n";

      // Добавляем кастомное сообщение если есть
      const args = ctx.message.text.split(" ").slice(1);
      if (args.length > 0) {
        messageText += `<b>Сообщение:</b> ${args.join(" ")}\n\n`;
      }

      // Пытаемся отметить участников
      try {
        // Этот метод работает в небольших чатах
        const members = await ctx.getChatMembers();
        members.forEach((member) => {
          if (member.status === "member" && member.user.username) {
            mentions.push(`@${member.user.username}`);
          }
        });

        if (mentions.length > 0) {
          messageText += mentions.join(" ");
          await ctx.replyWithHTML(messageText);
        } else {
          await ctx.reply("⚠️ Не найдено участников для отметки.");
        }
      } catch (error) {
        console.error("Ошибка при получении участников:", error);
        await ctx.reply(
          "⚠️ Бот не может получить список участников. Убедитесь, что у бота есть права администратора.",
        );
      }

      logger.logCommand(ctx, `tagall (${mentions.length} участников)`);
    } catch (err) {
      console.error("Ошибка в tagAll:", err);
      logger.logError(err, ctx);
      await ctx.reply("❌ Произошла ошибка при выполнении команды.");
    }
  },

  /**
   * Отправка ссылки на Discord-сервер
   */
  discord: async (ctx) => {
    try {
      const discordLink = "https://discord.gg/STX8mMGN"; // ЗАМЕНИТЕ НА РЕАЛЬНУЮ ССЫЛКУ
      await ctx.replyWithHTML(
        `🎮 <b>Официальный Discord сервер</b>\n\n` +
          `Присоединяйтесь к нашему сообществу:\n\n` +
          `<b>Ссылка:</b> ${discordLink}\n\n` +
          `<b>Преимущества:</b>\n` +
          `• Общение с участниками\n` +
          `• Эксклюзивные новости\n` +
          `• Игровые мероприятия\n` +
          `• Поддержка администрации\n\n` +
          `Ждем вас на сервере! 👋`,
      );
      logger.logCommand(ctx, "discord");
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply("Произошла ошибка при отправке Discord-ссылки.");
    }
  },

  awardUser: async (ctx) => {
    try {
      // Проверка прав (только админы)
      const member = await ctx.getChatMember(ctx.from.id);
      if (member.status !== "creator" && member.status !== "administrator") {
        await ctx.reply("❌ Эта команда только для администраторов.");
        return;
      }

      // Проверка, что это ответ на сообщение
      if (!ctx.message.reply_to_message) {
        await ctx.reply(
          "❌ Ответьте на сообщение пользователя, которого хотите наградить.",
        );
        return;
      }

      const targetUser = ctx.message.reply_to_message.from;
      if (targetUser.is_bot) {
        await ctx.reply("❌ Нельзя наградить бота.");
        return;
      }

      // Получаем причину (всё после "!наградить")
      const reason = ctx.message.text.split(" ").slice(1).join(" ").trim();
      if (!reason) {
        await ctx.reply(
          "❌ Укажите причину награды, например: `!наградить За активность`",
        );
        return;
      }

      // Загружаем текущие награды
      const awards = loadAwards();
      const chatId = ctx.chat.id.toString();
      const userId = targetUser.id.toString();

      // Создаем структуру, если её нет
      if (!awards[chatId]) awards[chatId] = {};
      if (!awards[chatId][userId]) awards[chatId][userId] = [];

      // Добавляем награду
      awards[chatId][userId].push({
        reason: reason,
        from: ctx.from.first_name,
        date: new Date().toISOString(),
      });

      // Сохраняем
      saveAwards(awards);

      // Отправляем подтверждение
      await ctx.reply(
        `🏆 Пользователь ${targetUser.first_name} награжден!\n` +
          `Причина: ${reason}`,
      );
      logger.logCommand(ctx, `award ${targetUser.id} for: ${reason}`);
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply("❌ Ошибка при выдаче награды.");
    }
  },

  /**
   * Add nickname for a user
   */
  addNickname: async (ctx) => {
    try {
      const args = ctx.message.text.split(" ").slice(1);
      const nickname = args.join(" ").trim();

      if (!nickname) {
        await ctx.reply(
          "Пожалуйста, укажите свой игровой ник после команды. Например: /addname Ice_Vendigo",
        );
        return;
      }

      if (nickname.length > 30) {
        await ctx.reply("Никнейм не должен превышать 30 символов.");
        return;
      }

      const nicknames = loadNicknames();
      const chatId = ctx.chat.id.toString();
      const userId = ctx.from.id.toString();

      if (!nicknames[chatId]) {
        nicknames[chatId] = {};
      }

      nicknames[chatId][userId] = {
        nickname: nickname,
        username: ctx.from.username || null,
        first_name: ctx.from.first_name || null,
        set_at: new Date().toISOString(),
      };

      saveNicknames(nicknames);
      await ctx.reply(`✅ Ваш игровой ник установлен: <b>${nickname}</b>`, {
        parse_mode: "HTML",
      });
      logger.logCommand(ctx, `addname ${nickname}`);
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply("Произошла ошибка при установке никнейма.");
    }
  },

  showRules: async (ctx) => {
    try {
      const rulesPath = path.join(__dirname, "../config/rules.json");
      const rulesData = fs.readFileSync(rulesPath, "utf8");
      const rules = JSON.parse(rulesData);

      let rulesText = `${rules.title}\n\n`;
      rules.rules.forEach((rule, index) => {
        rulesText += `${index + 1}. ${rule}\n`;
      });
      rulesText += `\n${rules.footer}`;

      await ctx.reply(rulesText);
      logger.logCommand(ctx, "rules");
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply("Произошла ошибка при получении правил.");
    }
  },

  showInfo: async (ctx) => {
    try {
      const infoPath = path.join(__dirname, "../config/info.json");
      const infoData = fs.readFileSync(infoPath, "utf8");
      const info = JSON.parse(infoData);

      if (info.infoText) {
        await ctx.reply(info.infoText, { parse_mode: "HTML" });
      } else {
        let infoText = `${info.title}\n\n`;
        info.sections.forEach((section) => {
          infoText += `<b>${section.title}</b>\n`;
          if (section.content) infoText += `${section.content}\n\n`;
          if (section.commands) {
            section.commands.forEach((cmd) => {
              infoText += `${cmd.command} - ${cmd.description}\n`;
            });
            infoText += "\n";
          }
        });
        infoText += info.footer;
        await ctx.reply(infoText, { parse_mode: "HTML" });
      }
      logger.logCommand(ctx, "info");
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply("Произошла ошибка при получении информации.");
    }
  },

  start: async (ctx) => {
    try {
      if (ctx.chat.type === "private") {
        await ctx.reply(
          "Привет! Я бот для модерации. Добавьте меня в свою группу, чтобы помочь с задачами модерации.",
        );
      } else {
        await ctx.reply(
          "Привет! Я теперь активен в этой группе. Используйте /help для списка команд.",
        );
      }
      logger.logCommand(ctx, "start");
    } catch (err) {
      logger.logError(err, ctx);
    }
  },

  help: async (ctx) => {
    try {
      const helpText =
        "🤖 <b>Команды бота</b>\n\n" +
        "• /rules - Показать правила группы\n" +
        "• /info - Показать информацию о группе\n" +
        "• /help - Показать это сообщение помощи\n" +
        "• /names - Показать список игровых никнеймов\n" +
        "• /addname - Установить игровой ник\n" +
        "• /discord - Ссылка на Discord-сервер\n\n" +
        "<b>Правила:</b>\n" +
        "• Запрещены любые ссылки, кроме YouTube и TikTok\n" +
        "По вопросам обращайтесь к администрации.";

      await ctx.reply(helpText, { parse_mode: "HTML" });
      logger.logCommand(ctx, "help");
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply("Произошла ошибка при отображении информации о помощи.");
    }
  },

  showNicknames: async (ctx) => {
    try {
      const nicknames = loadNicknames();
      const chatId = ctx.chat.id.toString();

      if (!nicknames[chatId] || Object.keys(nicknames[chatId]).length === 0) {
        await ctx.reply(
          "В группе пока нет игровых никнеймов. Добавьте свой ник с помощью команды /addname ТВОЙ_НИК",
        );
        return;
      }

      let message = "🎮 <b>Список игровых никнеймов:</b>\n\n";
      const nicknameEntries = Object.entries(nicknames[chatId]);
      nicknameEntries.sort((a, b) =>
        a[1].nickname.localeCompare(b[1].nickname),
      );

      for (const [userId, userData] of nicknameEntries) {
        const { nickname, username, first_name } = userData;
        const displayName = username
          ? `@${username}`
          : first_name || "Пользователь";
        message += `• ${displayName}: <b>${nickname}</b>\n`;
      }

      await ctx.reply(message, { parse_mode: "HTML" });
      logger.logCommand(ctx, "names");
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply("Произошла ошибка при отображении никнеймов.");
    }
  },

  muteUser: async (ctx) => {
    try {
      const member = await ctx.getChatMember(ctx.from.id);
      if (member.status !== "creator" && member.status !== "administrator") {
        await ctx.reply("Эта команда доступна только администраторам группы.");
        return;
      }

      if (!ctx.message.reply_to_message) {
        await ctx.reply(
          "Ответьте на сообщение пользователя, которого хотите замутить.",
        );
        return;
      }

      const targetUser = ctx.message.reply_to_message.from;
      if (targetUser.is_bot) {
        await ctx.reply("Нельзя замутить бота.");
        return;
      }

      const args = ctx.message.text.split(" ").slice(1);
      if (args.length < 1) {
        await ctx.reply("Укажите время мута (например: /mute 10m)");
        return;
      }

      let muteTime = parseInt(args[0]);
      let timeUnit = args[1] || "min";
      let muteSeconds = 0;

      switch (timeUnit.toLowerCase()) {
        case "sec":
          muteSeconds = muteTime;
          break;
        case "min":
          muteSeconds = muteTime * 60;
          break;
        case "ch":
        case "hour":
        case "hours":
          muteSeconds = muteTime * 3600;
          break;
        default:
          muteSeconds = muteTime * 60;
      }

      if (muteSeconds > 366 * 24 * 3600) muteSeconds = 366 * 24 * 3600;

      await ctx.restrictChatMember(targetUser.id, {
        can_send_messages: false,
        until_date: Math.floor(Date.now() / 1000) + muteSeconds,
      });

      let formattedTime = "";
      if (muteSeconds < 60) formattedTime = `${muteSeconds} секунд`;
      else if (muteSeconds < 3600)
        formattedTime = `${Math.floor(muteSeconds / 60)} минут`;
      else if (muteSeconds < 86400)
        formattedTime = `${Math.floor(muteSeconds / 3600)} часов`;
      else formattedTime = `${Math.floor(muteSeconds / 86400)} дней`;

      await ctx.reply(
        `Пользователь ${targetUser.username ? "@" + targetUser.username : targetUser.first_name} получил мут на ${formattedTime}.`,
      );
      logger.logCommand(
        ctx,
        `mute ${targetUser.username || targetUser.id} for ${formattedTime}`,
      );
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply(
        "Не удалось замутить пользователя. Проверьте права бота.",
      );
    }
  },

  unmuteUser: async (ctx) => {
    try {
      const member = await ctx.getChatMember(ctx.from.id);
      if (member.status !== "creator" && member.status !== "administrator") {
        await ctx.reply("Эта команда доступна только администраторам группы.");
        return;
      }

      if (!ctx.message.reply_to_message) {
        await ctx.reply(
          "Ответьте на сообщение пользователя, которого хотите размутить.",
        );
        return;
      }

      const targetUser = ctx.message.reply_to_message.from;
      await ctx.restrictChatMember(targetUser.id, {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
      });

      await ctx.reply(
        `Мут снят с пользователя ${targetUser.username ? "@" + targetUser.username : targetUser.first_name}.`,
      );
      logger.logCommand(ctx, `unmute ${targetUser.username || targetUser.id}`);
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply("Не удалось снять мут. Проверьте права бота.");
    }
  },

  kickUser: async (ctx) => {
    try {
      const member = await ctx.getChatMember(ctx.from.id);
      if (member.status !== "creator" && member.status !== "administrator") {
        await ctx.reply("Эта команда доступна только администраторам группы.");
        return;
      }

      if (!ctx.message.reply_to_message) {
        await ctx.reply(
          "Ответьте на сообщение пользователя, которого хотите исключить.",
        );
        return;
      }

      const targetUser = ctx.message.reply_to_message.from;
      const reason =
        ctx.message.text.split(" ").slice(1).join(" ") ||
        "без указания причины";

      await ctx.kickChatMember(targetUser.id);
      await ctx.unbanChatMember(targetUser.id);

      await ctx.reply(
        `Пользователь ${targetUser.username ? "@" + targetUser.username : targetUser.first_name} исключен.\nПричина: ${reason}`,
      );
      logger.logCommand(
        ctx,
        `kick ${targetUser.username || targetUser.id} (${reason})`,
      );
    } catch (err) {
      logger.logError(err, ctx);
      await ctx.reply(
        "Не удалось исключить пользователя. Проверьте права бота.",
      );
    }
  },
};
