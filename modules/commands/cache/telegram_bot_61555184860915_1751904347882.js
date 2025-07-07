const TelegramBot = require('node-telegram-bot-api');  
const token = '7978012210:AAEE1dgNFrk8BdgTfwQWmSWuhqQz5pu4VmQ';  
const bot = new TelegramBot(token, {polling: true});  
bot.onText(/\/start/, (msg) => {  
  const chatId = msg.chat.id;  
  bot.sendMessage(chatId, 'Welcome to the news bot!');  
});  
bot.onText(/\/news/, (msg) => {  
  const chatId = msg.chat.id;  
  const newsMessage = 'Here are the latest news updates...';  
  bot.sendMessage(chatId, newsMessage);  
});  
bot.onText(/\/help/, (msg) => {  
  const chatId = msg.chat.id;  
  const helpMessage = 'Use /news to get the latest news updates.';  
  bot.sendMessage(chatId, helpMessage);  
});  