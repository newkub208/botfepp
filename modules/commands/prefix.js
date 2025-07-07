const fs = require('fs');
const { safeSendMessage } = require('../../utils/messageUtils');

module.exports = {
  name: 'prefix',
  description: 'Replies with the prefix',
  nashPrefix: false,
  async execute(api, event, args, prefix) {
    try {
      const message = `Yo, my prefix is [ 𓆩 '${prefix}' 𓆪 ]\n\n𝗦𝗢𝗠𝗘 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗦 𝗧𝗛𝗔𝗧 𝗠𝗔𝗬 𝗛𝗘𝗟𝗣 𝗬𝗢𝗨:\n➥ '${prefix}help [command] -> information and usage of command\n\nHave fun using it, enjoy! ❤`;
      
      const imagePath = './josh.jpeg';

      
      if (fs.existsSync(imagePath)) {
        const attachment = fs.createReadStream(imagePath);
        await safeSendMessage(api, { body: message, attachment }, event.threadID);
      } else {
        
        await safeSendMessage(api, message, event.threadID);
      }
    } catch (error) {
      console.error('Error executing command:', error);
      await safeSendMessage(api, 'An error occurred while executing the command.', event.threadID);
    }
  },
};