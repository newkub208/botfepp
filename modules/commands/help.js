const fs = require('fs');
const path = require('path');
const config = require('../../config.json');

module.exports = {
  name: 'ช่วยเหลือ',
  description: 'แสดงรายการคำสั่งทั้งหมดหรือข้อมูลคำสั่งที่ระบุ',
  usage: '[nashPrefix]ช่วยเหลือ [ชื่อคำสั่ง]',
  nashPrefix: false,
  aliases: ['help', 'คำสั่ง', 'commands'],
  execute: async (api, event, args, prefix) => {
    const { threadID, messageID } = event;
    const commandsPath = path.join(__dirname);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    if (args.length === 0) {
      const commands = [];
      for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if (command.name) {
          commands.push({
            name: command.name,
            description: command.description || 'No description available',
            nashPrefix: command.nashPrefix || false,
            aliases: command.aliases || []
          });
        }
      }

      let helpMessage = `🤖 𝗄ำสั่ง𝗡𝗔𝗦𝗛 𝗕𝗢𝗧 🤖\n`;
      helpMessage += `════════════════════\n\n`;

      const prefixCommands = commands.filter(cmd => cmd.nashPrefix);
      const noPrefixCommands = commands.filter(cmd => !cmd.nashPrefix);

      if (prefixCommands.length > 0) {
        helpMessage += `📋 คำสั่งที่ใช้เครื่องหมาย (${prefix}):\n`;
        helpMessage += `────────────────────\n`;
        prefixCommands.forEach((cmd, index) => {
          helpMessage += `${index + 1}. ${prefix}${cmd.name}`;
          if (cmd.aliases.length > 0) {
            helpMessage += ` (${cmd.aliases.map(alias => prefix + alias).join(', ')})`;
          }
          helpMessage += `\n   └ ${cmd.description}\n\n`;
        });
      }

      if (noPrefixCommands.length > 0) {
        helpMessage += `🔧 คำสั่งไม่ใช้เครื่องหมาย:\n`;
        helpMessage += `────────────────────\n`;
        noPrefixCommands.forEach((cmd, index) => {
          helpMessage += `${index + 1}. ${cmd.name}`;
          if (cmd.aliases.length > 0) {
            helpMessage += ` (${cmd.aliases.join(', ')})`;
          }
          helpMessage += `\n   └ ${cmd.description}\n\n`;
        });
      }

      helpMessage += `════════════════════\n`;
      helpMessage += `👨‍💻 ผู้พัฒนา: Cyberasfe Panvila`;
      await api.shareContact(helpMessage, config.adminUID, threadID);
      return;
    }
  }
};