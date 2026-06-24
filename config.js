require('dotenv').config();

// Helper function to convert Telegram usernames to URLs for tasks
function getTaskUrls() {
  const convertToUrl = (username) => {
    if (username.startsWith('@')) {
      return `https://t.me/${username.substring(1)}`;
    }
    if (username.startsWith('http')) {
      return username;
    }
    return `https://t.me/${username}`;
  };

  return {
    TELEGRAM_CHANNEL: process.env.TELEGRAM_CHANNEL,
    TELEGRAM_GROUP: process.env.TELEGRAM_GROUP,
    TELEGRAM_CHANNEL_URL: convertToUrl(process.env.TELEGRAM_CHANNEL),
    TELEGRAM_GROUP_URL: convertToUrl(process.env.TELEGRAM_GROUP),
    TWITTER_PROFILE: process.env.TWITTER_PROFILE,
    RETWEET_LINK: process.env.RETWEET_LINK,
    TWEET_POST: process.env.TWEET_POST
  };
}

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  MONGODB_URL: process.env.MONGODB_URL,
  ADMIN_ID: parseInt(process.env.ADMIN_ID),
  
  // Task URLs - both original and converted versions
  TASK_URLS: getTaskUrls(),
  
  // Bot configuration
  BOT_CONFIG: {
    MCJ_TOKEN_SYMBOL: process.env.MCJ_TOKEN_SYMBOL || 'MCJ',
    TASK_REWARD: 50,
    REFERRAL_REWARD: 25,
    MIN_REFERRALS_FOR_LEADERBOARD: 1
  }
};

// Validate required environment variables
const required = ['BOT_TOKEN', 'MONGODB_URL', 'TELEGRAM_CHANNEL', 'TELEGRAM_GROUP'];
required.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

console.log('✅ Environment variables loaded successfully');