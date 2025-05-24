const { Telegraf } = require("telegraf");
const express = require("express");
const fs = require("fs");
const path = require("path");
const config = require("./config/config.json");
const linkFilter = require("./middlewares/linkFilter");
const profanityFilter = require("./middlewares/profanityFilter");
const commandHandlers = require("./handlers/commands");
const memberEvents = require("./handlers/memberEvents");
const logger = require("./utils/logger");

// Путь к файлу с данными пользователей
const usersDataPath = path.join(__dirname, "data");
if (!fs.existsSync(usersDataPath)) {
  fs.mkdirSync(usersDataPath);
}

const usersFilePath = path.join(usersDataPath, "group_users.json");

// Загрузка или создание структуры для хранения пользователей
let groupUsers = {};
try {
  if (fs.existsSync(usersFilePath)) {
    const data = fs.readFileSync(usersFilePath, "utf8");
    groupUsers = JSON.parse(data);
  }
} catch (err) {
  console.error("Ошибка при чтении файла с пользователями:", err);
  groupUsers = {};
}

// Функция для сохранения пользователей
function saveUsers() {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(groupUsers, null, 2));
  } catch (err) {
    console.error("Ошибка при сохранении данных пользователей:", err);
  }
}

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN || config.botToken);

// Set up logging and user tracking
bot.use((ctx, next) => {
  logger.logAction(ctx);

  if (ctx.from && !ctx.from.is_bot && ctx.chat && ctx.chat.type !== "private") {
    const chatId = ctx.chat.id.toString();
    if (!groupUsers[chatId]) {
      groupUsers[chatId] = {
        title: ctx.chat.title || `Чат ${chatId}`,
        users: {},
      };
    }

    const userId = ctx.from.id.toString();
    groupUsers[chatId].users[userId] = {
      id: ctx.from.id,
      username: ctx.from.username || null,
      first_name: ctx.from.first_name || null,
      last_name: ctx.from.last_name || null,
      last_active: new Date().toISOString(),
    };

    if (Math.random() < 0.1) {
      saveUsers();
    }
  }

  return next();
});

// Register middlewares
bot.use(profanityFilter);
bot.use(linkFilter);

// Register command handlers
// В разделе регистрации команд добавляем:
bot.command("tagall", commandHandlers.tagAll);
bot.command("rules", commandHandlers.showRules);
bot.command("discord", commandHandlers.discord);
bot.command("fam", commandHandlers.showInfo);
bot.command("start", commandHandlers.start);
bot.command("help", commandHandlers.help);
bot.command("names", commandHandlers.showNicknames);
bot.command("addname", commandHandlers.addNickname);
bot.command("mute", (ctx) => commandHandlers.muteUser(ctx, groupUsers));
bot.command("unmute", (ctx) => commandHandlers.unmuteUser(ctx, groupUsers));
bot.command("kick", (ctx) => commandHandlers.kickUser(ctx, groupUsers));

// Handle member events
bot.on("new_chat_members", (ctx) =>
  memberEvents.handleNewMember(ctx, groupUsers, saveUsers),
);
bot.on("left_chat_member", (ctx) =>
  memberEvents.handleLeftMember(ctx, groupUsers, saveUsers),
);

// Handle all messages
bot.on("message", (ctx, next) => {
  if (Math.random() < 0.05) {
    saveUsers();
  }
  return next();
});

// Text message handler
bot.on("text", async (ctx, next) => {
  try {
    if (ctx.from && !ctx.from.is_bot && ctx.chat && ctx.chat.id) {
      const chatId = ctx.chat.id.toString();
      const userId = ctx.from.id.toString();

      if (!groupUsers[chatId]) {
        groupUsers[chatId] = {
          title: ctx.chat.title || `Чат ${chatId}`,
          users: {},
        };
      }

      groupUsers[chatId].users[userId] = {
        id: ctx.from.id,
        username: ctx.from.username || null,
        first_name: ctx.from.first_name || null,
        last_name: ctx.from.last_name || null,
        last_active: new Date().toISOString(),
        is_bot: ctx.from.is_bot || false,
      };
    }
  } catch (err) {
    logger.logError(`Ошибка при отслеживании пользователей: ${err.message}`);
  }
  return next();
});

// Error handling
bot.catch((err, ctx) => {
  logger.logError(err, ctx);
  ctx.reply("Произошла ошибка при обработке вашего запроса.");
});

// Launch bot
bot
  .launch()
  .then(() => {
    console.log("Бот успешно запущен!");
  })
  .catch((err) => {
    console.error("Не удалось запустить бота:", err);
  });

// Graceful shutdown
process.once("SIGINT", () => {
  saveUsers();
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  saveUsers();
  bot.stop("SIGTERM");
});

// Web server for hosting
if (config.useWebhook) {
  const app = express();
  const PORT = process.env.PORT || 8000;

  app.get("/", (req, res) => {
    res.send("Телеграм бот модерации работает!");
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Веб-сервер запущен на порту ${PORT}`);
  });
}
