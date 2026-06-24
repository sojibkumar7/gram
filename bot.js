const { Telegraf, session } = require('telegraf');
const connectDB = require('./database/db');
const config = require('./config');

// Handlers
const StartHandler = require('./handlers/startHandler');
const TaskHandler = require('./handlers/taskHandler');
const ProfileHandler = require('./handlers/profileHandler');
const ReferralHandler = require('./handlers/referralHandler');
const AdminHandler = require('./handlers/adminHandler');
const TelegramCheck = require('./utils/telegramCheck');
const Keyboards = require('./utils/keyboards');

// Initialize bot with webhook (better for production)
const bot = new Telegraf(config.BOT_TOKEN, {
  telegram: { webhookReply: false } // Better for high load
});

// FIXED: Proper session middleware setup
bot.use(session({
  defaultSession: () => ({})
}));

// Helper function to check if it's a private chat
const isPrivateChat = (ctx) => {
  return ctx.chat && ctx.chat.type === 'private';
};

// Rate limiting to prevent spam
const userLastAction = new Map();
const RATE_LIMIT_MS = 1000; // 1 second between actions

function checkRateLimit(userId) {
  const now = Date.now();
  const lastAction = userLastAction.get(userId);
  
  if (lastAction && (now - lastAction) < RATE_LIMIT_MS) {
    return false;
  }
  
  userLastAction.set(userId, now);
  return true;
}

// Start command - ONLY in private chats
bot.start(async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  
  const userId = ctx.from.id;
  if (!checkRateLimit(userId)) {
    await ctx.reply('⏳ Please wait a moment before trying again.');
    return;
  }
  
  await StartHandler.handleStart(ctx);
});

// Message handlers - ONLY in private chats
bot.on('message', async (ctx) => {
  // Ignore group messages
  if (!isPrivateChat(ctx)) return;
  
  // Check if message contains text
  if (!ctx.message || !ctx.message.text) return;
  
  const userId = ctx.from.id;
  if (!checkRateLimit(userId)) return;
  
  // Check if user is banned
  const { User } = require('./database/models');
  const user = await User.findOne({ telegramId: userId });
  
  if (user && user.isBanned) {
    await ctx.reply('❌ Your account has been banned.');
    return;
  }
  
  const text = ctx.message.text;
  
  // Handle admin commands first
  if (text.startsWith('/admin')) {
    await AdminHandler.handleAdminCommand(ctx);
    return;
  }
  
  // Handle different message types based on session state
  if (ctx.session.awaitingCaptcha) {
    await StartHandler.handleCaptcha(ctx);
  } else if (ctx.session.setupStage) {
    await ProfileHandler.handleProfileSetup(ctx);
  } else if (ctx.session.editingField) {
    await ProfileHandler.handleEditInput(ctx);
  } else if (ctx.session.awaitingBroadcast && AdminHandler.isAdmin(ctx.from.id)) {
    await AdminHandler.handleBroadcast(ctx);
  } else {
    // Handle regular menu commands
    switch (text) {
      case '💰 Balance':
        const balanceUser = await User.findOne({ telegramId: ctx.from.id });
        if (balanceUser) {
          await ctx.reply(
            `💰 Your Balance: ${balanceUser.balance} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL}\n\n` +
            `Refer friends to climb the leaderboard!`
          );
        }
        break;
        
      case '👤 Profile':
        await ProfileHandler.showProfile(ctx);
        break;
        
      case '📊 Referral':
        await ReferralHandler.showReferralInfo(ctx);
        break;
        
      case '🏆 Leaderboard':
        await ReferralHandler.showLeaderboard(ctx);
        break;
        
      case '⬅️ Back':
        await ctx.reply('Main menu:', Keyboards.mainMenu());
        break;
        
      default:
        // Ignore unknown messages
        break;
    }
  }
});

// Callback query handlers - ONLY in private chats
bot.on('callback_query', async (ctx) => {
  if (!isPrivateChat(ctx)) {
    await ctx.answerCbQuery();
    return;
  }
  
  const userId = ctx.from.id;
  if (!checkRateLimit(userId)) {
    await ctx.answerCbQuery('⏳ Please wait...');
    return;
  }
  
  const data = ctx.callbackQuery.data;
  
  try {
    switch (data) {
      case 'continue_tasks':
        await StartHandler.handleContinueTasks(ctx);
        break;
        
      case 'edit_twitter':
        await ProfileHandler.handleEditProfile(ctx, 'twitter');
        break;
        
      case 'edit_telegram':
        await ProfileHandler.handleEditProfile(ctx, 'telegram');
        break;
        
      case 'edit_wallet':
        await ProfileHandler.handleEditProfile(ctx, 'wallet');
        break;
        
      case 'main_menu':
        await ctx.reply('Main menu:', Keyboards.mainMenu());
        await ctx.answerCbQuery();
        break;
        
      case 'referral_stats':
        await ReferralHandler.showReferralInfo(ctx);
        await ctx.answerCbQuery();
        break;
        
      // NEW: Handle the inline main menu buttons
      case 'show_balance':
        const balanceUser = await User.findOne({ telegramId: ctx.from.id });
        if (balanceUser) {
          await ctx.reply(
            `💰 Your Balance: ${balanceUser.balance} ${config.BOT_CONFIG.MCJ_TOKEN_SYMBOL}\n\n` +
            `Refer friends to climb the leaderboard!`
          );
        }
        await ctx.answerCbQuery();
        break;
        
      case 'show_profile':
        await ProfileHandler.showProfile(ctx);
        await ctx.answerCbQuery();
        break;
        
      case 'show_referral':
        await ReferralHandler.showReferralInfo(ctx);
        await ctx.answerCbQuery();
        break;
        
      case 'show_leaderboard':
        await ReferralHandler.showLeaderboard(ctx);
        await ctx.answerCbQuery();
        break;
        
      default:
        await ctx.answerCbQuery();
    }
  } catch (error) {
    console.error('Callback query error:', error);
    await ctx.answerCbQuery('❌ Error processing request');
  }
});

// Admin commands - ONLY in private chats
bot.command('adminpanel', async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  await AdminHandler.handleAdminCommand(ctx);
});

// Task command - ONLY in private chats
bot.command('tasks', async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  await StartHandler.showTasks(ctx);
});

// Membership check command - ONLY in private chats
bot.command('check', async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  const membership = await TelegramCheck.verifyAllMemberships(ctx, ctx.from.id);
  await ctx.reply(TelegramCheck.getMembershipMessage(membership));
});

// Help command - ONLY in private chats
bot.command('help', async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  ctx.reply(
    `🤖 *MCJ Bot Commands*\n\n` +
    `/start - Start the bot\n` +
    `/tasks - Show available tasks\n` +
    `/check - Check channel membership\n` +
    `/admin - Admin commands (admin only)\n` +
    `/help - Show this help message\n\n` +
    `Use the menu buttons to navigate through the bot.`,
    { parse_mode: 'Markdown' }
  );
});

// Handle other types of messages - ONLY in private chats
bot.on(['photo', 'document', 'sticker', 'video'], async (ctx) => {
  if (!isPrivateChat(ctx)) return;
  await ctx.reply('❌ Please use text messages only with this bot.');
});

// Error handling - with private chat check
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  // Only reply to errors in private chats
  if (ctx && ctx.reply && isPrivateChat(ctx)) {
    ctx.reply('❌ An error occurred. Please try again later.');
  }
});

// Start function with process management
async function startBot() {
  try {
    await connectDB();
    
    // Check if another instance is running
    try {
      await bot.telegram.getMe();
      console.log('🔍 Checking for existing bot instances...');
    } catch (error) {
      if (error.code === 409) {
        console.log('⚠️ Another bot instance detected. Waiting 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    await bot.launch();
    console.log('🤖 MCJ Bot started successfully');
    console.log('👑 Admin ID:', config.ADMIN_ID);
    
    // Enable graceful stop
    process.once('SIGINT', () => {
      console.log('🛑 Shutting down gracefully...');
      bot.stop('SIGINT');
    });
    
    process.once('SIGTERM', () => {
      console.log('🛑 Shutting down gracefully...');
      bot.stop('SIGTERM');
    });
    
  } catch (error) {
    if (error.code === 409) {
      console.error('❌ Another bot instance is already running!');
      console.error('💡 Solution: Kill the existing process or wait for it to stop.');
      console.error('   Run: pkill -f "node bot.js"');
    } else {
      console.error('Failed to start bot:', error);
    }
    process.exit(1);
  }
}

// Clean up rate limit map every hour
setInterval(() => {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  
  for (const [userId, timestamp] of userLastAction.entries()) {
    if (timestamp < oneHourAgo) {
      userLastAction.delete(userId);
    }
  }
}, 3600000);

// Start the bot
startBot();

module.exports = bot;

