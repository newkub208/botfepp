const fs = require('fs');
const path = require('path');
const axios = require('axios');

module.exports = {
  name: "joinNoti",
  version: "1.1.0",
  description: "Join notifications with auto-kick integration",
  author: "joshuaApostol",
  async onEvent({ api, event, prefix }) {
    try {
      const { logMessageType, logMessageData, threadID } = event;

      if (logMessageType === "log:subscribe") {
        const currentUserID = await api.getCurrentUserID();

        if (logMessageData.addedParticipants?.some(i => i.userFbId === currentUserID)) {
          await api.changeNickname(`[ ${prefix} ]: NashBoT`, threadID, currentUserID);

          const welcomeMessage = `
            📌 𝗡𝗔𝗦𝗛𝗕𝗢𝗧 เข้าร่วมแล้ว 📌
            › ${prefix} เชื่อมต่อสำเร็จแล้ว!
            › ใช้ ${prefix}ช่วยเหลือ เพื่อดูคำสั่งที่มีให้ใช้!
          `;

          await api.sendMessage(welcomeMessage, threadID);
        } else {
          const { addedParticipants } = logMessageData;
          const threadInfo = await api.getThreadInfo(threadID);
          const currentMembersCount = threadInfo.participantIDs.length;

          // Process each new member
          for (const participant of addedParticipants) {
            try {
              // Get user info
              const userInfo = await api.getUserInfo(participant.userFbId);
              const userName = participant.fullName || userInfo[participant.userFbId]?.name || 'สมาชิกใหม่';
              
              // Use the specified GIF URL
              const welcomeGifUrl = 'https://i.pinimg.com/originals/ff/81/de/ff81dee1dcdd40d560569fe2ae94b6d3.gif';

              // Download the welcome GIF
              const response = await axios.get(welcomeGifUrl, { 
                responseType: 'arraybuffer',
                timeout: 15000,
                validateStatus: function (status) {
                  return status >= 200 && status < 300;
                }
              });

              if (response.status === 200) {
                const welcomeMessage = `สวัสดี ${userName} 🎉\nคุณเป็นสมาชิกคนที่ ${currentMembersCount} ของ 🤖${threadInfo.name}🤖\n\n『 ขอให้สนุกและมีความสุขกับการอยู่ที่นี่ 』\n\n⚠️ หมายเหตุ: กรุณาพูดคุยภายใน 10 นาที มิฉะนั้นจะถูกเตะออกจากกลุ่มอัตโนมัติ`;

                // Save GIF temporarily
                const tempFileName = `welcome_${participant.userFbId}_${Date.now()}.gif`;
                const tempFilePath = path.join(__dirname, '../commands/cache', tempFileName);
                
                // Ensure cache directory exists
                const cacheDir = path.join(__dirname, '../commands/cache');
                if (!fs.existsSync(cacheDir)) {
                  fs.mkdirSync(cacheDir, { recursive: true });
                }
                
                // Write GIF to temporary file
                fs.writeFileSync(tempFilePath, Buffer.from(response.data));
                
                // Create read stream from temporary file
                const gifStream = fs.createReadStream(tempFilePath);

                // Send welcome message with the GIF
                await api.sendMessage({
                  body: welcomeMessage,
                  attachment: gifStream
                }, threadID);

                // Clean up temporary file after a delay
                setTimeout(() => {
                  try {
                    if (fs.existsSync(tempFilePath)) {
                      fs.unlinkSync(tempFilePath);
                    }
                  } catch (cleanupError) {
                    console.error('Error cleaning up temp file:', cleanupError);
                  }
                }, 10000); // Delete after 10 seconds

              } else {
                throw new Error(`Failed to download GIF: ${response.status}`);
              }

            } catch (error) {
              const userName = participant.fullName || 'สมาชิกใหม่';
              console.error('Error sending welcome GIF for user:', userName);
              console.error('Error details:', error.response?.status, error.response?.statusText);
              
              // Fallback to text-only message if GIF fails
              const fallbackMessage = `สวัสดี ${userName} 🎉\nคุณเป็นสมาชิกคนที่ ${currentMembersCount} ของ 🤖${threadInfo.name}🤖\n\n『 ขอให้สนุกและมีความสุขกับการอยู่ที่นี่ 』\n\n⚠️ หมายเหตุ: กรุณาพูดคุยภายใน 10 นาที มิฉะนั้นจะถูกเตะออกจากกลุ่มอัตโนมัติ`;
              await api.sendMessage(fallbackMessage, threadID);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in joinNoti event:', error);
      api.sendMessage('An error occurred while processing the join notification.', event.threadID);
    }
  },
};
