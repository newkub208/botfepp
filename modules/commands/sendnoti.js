const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../../config.json');

module.exports = {
  name: 'sendnoti',
  description: 'Sends a notification message to all groups',
  usage: '[nashPrefix]sendnoti [Text]',
  nashPrefix: true,
  role: "admin",
  execute: async (api, event, args) => {
    const threadList = await api.getThreadList(100, null, ['INBOX']);
    const customMessage = args.join(' ');

    if (!customMessage) {
      await api.sendMessage('Usage: sendnoti [Text].', event.threadID);
      return;
    }

    const waitMessage = await api.sendMessage('Please wait while the notification is being sent...', event.threadID);

    let sentCount = 0;

    for (const thread of threadList) {
      if (sentCount >= 20) break;
      if (thread.isGroup && thread.threadID !== event.threadID) {
        try {
          await api.shareContact(
            `【 𝗡𝗔𝗦𝗛 】 𝗡𝗼𝘁𝗶𝗳𝗶𝗰𝗮𝘁𝗶𝗼𝗻 📢\n──────────────────\n📋 𝗠𝗲𝘀𝘀𝗮𝗴𝗲: ${customMessage}\n\n👨‍💻 𝗙𝗿𝗼𝗺: 𝗡𝗮𝘀𝗵 𝗔𝗱𝗺𝗶𝗻\n──────────────────`,
            config.adminUID,
            thread.threadID
          );
          sentCount++;
          
          const cacheDir = path.join(__dirname, 'cache');
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
          }
          const audioPath = path.join(cacheDir, `${thread.threadID}_audio.mp3`);
          await downloadFile(
            `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(customMessage)}&tl=en&client=tw-ob`,
            audioPath
          );
          await api.sendMessage({ attachment: fs.createReadStream(audioPath) }, thread.threadID);
          fs.unlinkSync(audioPath);
        } catch (error) {
          console.error(`Error sending message to thread ${thread.threadID}:`, error);
        }
      }
    }

    if (sentCount > 0) {
      api.editMessage(`› Sent ${sentCount} notifications successfully.`, waitMessage.messageID);
    } else {
      api.editMessage('› No eligible group threads found to send the message to.', waitMessage.messageID);
    }
  }
};

async function downloadFile(url, filePath) {
  const writer = fs.createWriteStream(filePath);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}