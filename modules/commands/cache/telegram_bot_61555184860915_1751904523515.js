const TelegramBot = require('node-telegram-bot-api');  
const token = '7978012210:AAEE1dgNFrk8BdgTfwQWmSWuhqQz5pu4VmQ';  
const bot = new TelegramBot(token, { polling: true });  

bot.onText(/\/start/, (msg) => {  
    const chatId = msg.chat.id;  
    bot.sendMessage(chatId, 'Welcome to the News Bot!');  
});  

bot.onText(/\/news/, (msg) => {  
    const chatId = msg.chat.id;  
    bot.sendMessage(chatId, 'Here are the latest news updates...');  
});  

bot.on('message', (msg) => {  
    const chatId = msg.chat.id;  
    bot.sendMessage(chatId, 'You said: ' + msg.text);  
});  