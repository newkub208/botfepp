const TelegramBot = require('node-telegram-bot-api');
const token = '7978012210:AAEE1dgNFrk8BdgTfwQWmSWuhqQz5pu4VmQ';
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'ยินดีต้อนรับสู่บอทของเรา! ถามอะไรก็ได้เลย');
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const response = `คุณพูดว่า: ${msg.text}`;
    bot.sendMessage(chatId, response);
});

// --- Graceful Shutdown Handler ---
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing Telegram bot polling.');
  bot.stopPolling({ cancel: true }).then(() => {
    console.log('Telegram bot polling stopped. Exiting process.');
    process.exit(0);
  }).catch(err => {
    console.error('Error stopping polling:', err);
    process.exit(1);
  });
});
