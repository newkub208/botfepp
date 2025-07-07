const { exec } = require("child_process");
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'shell',
  description: 'Run shell commands.',
  usage: '[nashPrefix]shell [command]',
  nashPrefix: false,
  execute: async (api, event, args, prefix) => {
    const command = args.join(' ');

    if (!command) {
      await api.sendMessage('Missing input.', event.threadID, event.messageID);
      return;
    }

    const configPath = path.join(__dirname, '../../config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    if (event.senderID !== config.adminUID) {
      await api.sendMessage("You don't have permission to use this command.", event.threadID, event.messageID);
      return;
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        api.sendMessage(`Error Output:\n${error.message}`, event.threadID, event.messageID);
        return;
      }
      if (stderr) {
        api.sendMessage(`Error Output:\n${stderr}`, event.threadID, event.messageID);
        return;
      }
      api.sendMessage(`Output:\n${stdout}`, event.threadID, event.messageID);
    });
  }
};