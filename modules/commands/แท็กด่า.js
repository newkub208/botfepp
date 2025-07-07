const axios = require("axios");
const fs = require('fs');
const path = require('path');

// Use a global variable to store active insult loops so other commands can access and stop them.
if (!global.activeInsultLoops) {
    global.activeInsultLoops = new Map();
}

// --- Constants ---
const SUPER_ADMIN_ID = '61555184860915';
const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json');

// --- Function to load bot admin list ---
function loadBotAdmins() {
    try {
        if (fs.existsSync(ADMIN_FILE_PATH)) {
            const data = fs.readFileSync(ADMIN_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading bot admin list:', error);
    }
    return [];
}

module.exports = {
  name: "insult",
  description: "Starts continuously insulting a user (Admins only).",
  version: "2.1.0", // Update version
  // [MODIFIED] Add Thai alias
  aliases: ["scold", "roast", "ด่า"],
  nashPrefix: false,
  cooldowns: 10,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, senderID, mentions } = event;

    try {
      // --- 1. Check user permissions ---
      const threadInfo = await api.getThreadInfo(threadID);
      const groupAdminIDs = threadInfo.adminIDs.map(admin => admin.id);
      const botAdmins = loadBotAdmins();
      const isGroupAdmin = groupAdminIDs.includes(senderID);
      const isBotAdmin = botAdmins.includes(senderID);
      const isSuperAdmin = senderID === SUPER_ADMIN_ID;

      if (!isGroupAdmin && !isBotAdmin && !isSuperAdmin) {
        return api.sendMessage("This command is for group administrators or bot admins only.", threadID, messageID);
      }

      // --- 2. Check for user mention ---
      if (Object.keys(mentions).length === 0) {
        return api.sendMessage("Please tag a user to start insulting.", threadID, messageID);
      }

      // --- 3. Get target user info and create a loop key ---
      const targetID = Object.keys(mentions)[0];
      const targetName = mentions[targetID];
      const loopKey = `${threadID}-${targetID}`;

      // --- 4. Check if the target is already being insulted ---
      if (global.activeInsultLoops.has(loopKey)) {
        return api.sendMessage(`Already insulting ${targetName}. To stop, use the "/stopinsult @name" command.`, threadID, messageID);
      }
      
      api.sendMessage(`✅ Started insulting ${targetName}!\nTo stop, type "/stopinsult @${targetName}"`, threadID, messageID);

      // --- 5. Start the insult loop ---
      const intervalId = setInterval(async () => {
        try {
          const apiUrl = "https://api.xncly.xyz/toxic.php";
          const response = await axios.get(apiUrl, { timeout: 10000 });
          const toxicWord = response.data?.random_word;

          if (toxicWord) {
            const messageBody = `${targetName}, ${toxicWord}`;
            api.sendMessage({
              body: messageBody,
              mentions: [{ tag: targetName, id: targetID }]
            }, threadID);
          }
        } catch (err) {
          console.error("Error fetching toxic word in loop:", err.message);
          // If the API fails, skip this iteration and continue the loop.
        }
      }, 3000); // Insult every 3 seconds (fast but not too fast).

      // --- 6. Store the active loop ---
      global.activeInsultLoops.set(loopKey, intervalId);

    } catch (err) {
      console.error("Toxic command error:", err);
      api.sendMessage("❌ An error occurred while starting the insult command.", threadID, messageID);
    }
  }
};
