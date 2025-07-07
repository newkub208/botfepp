const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: "leaveNoti",
  version: "1.0.0",
  description: "Leave notifications",
  author: "joshuaApostol",
  async onEvent({ api, event, prefix }) {
    try {
      const { logMessageType, logMessageData, threadID } = event;

      if (
        logMessageType === "log:unsubscribe" &&
        logMessageData.leftParticipantFbId === api.getCurrentUserID()
      ) {
        api.changeNickname(
          `[ ${prefix} ]: NashBoT`,
          threadID,
          api.getCurrentUserID()
        );

        const leaveMessage = `
          📌 𝗡𝗔𝗦𝗛𝗕𝗢𝗧 ออกจากกลุ่มแล้ว 📌
          › ${prefix} ได้ออกจากการสนทนาแล้ว
          › หากต้องการความช่วยเหลือ ใช้ ${prefix}ช่วยเหลือ เพื่อดูคำสั่งที่มีให้ใช้!
        `;

        api.sendMessage(leaveMessage, threadID);
      } else if (
        logMessageType === "log:unsubscribe" &&
        logMessageData.leftParticipantFbId !== api.getCurrentUserID()
      ) {
        const { leftParticipantFbId } = logMessageData;

        const leftUserInfo = await api.getUserInfo(leftParticipantFbId);
        const leftUserName = leftUserInfo[leftParticipantFbId]?.name || "Unknown";

        const threadInfo = await api.getThreadInfo(threadID);
        const currentMembersCount = threadInfo.participantIDs.length;
        const leaveMessage = `
          🚪 𝗔𝗱𝗱𝗶𝗲𝗮𝗮 ออกจากกลุ่มแล้ว 🚪\n\n› ${leftUserName} ได้ออกจาก ${threadInfo.name} แล้ว\n\nขณะนี้มีสมาชิก ${currentMembersCount} คนในกลุ่ม\n\n『 หวังว่าจะได้เจอกันอีกเร็วๆ นี้! 』
        `;

        const gifUrl = "https://media3.giphy.com/media/vxNCVEe0PI9A3YVJEX/giphy.gif?cid=6c09b952ygxao9r8x79t3enqjb9z02khzf36dntnwqyhcqm2&ep=v1_internal_gif_by_id&rid=giphy.gif&ct=g";
        const gifPath = path.join(__dirname, 'farewell.gif');

        const downloadGif = async (url, path) => {
          const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
          });
          return new Promise((resolve, reject) => {
            response.data.pipe(fs.createWriteStream(path))
              .on('finish', () => resolve())
              .on('error', e => reject(e));
          });
        };

        await downloadGif(gifUrl, gifPath);

        const gifStream = fs.createReadStream(gifPath);

        api.sendMessage({
          body: leaveMessage,
          attachment: gifStream
        }, threadID);
      }
    } catch (error) {
      console.error('Error in leaveNoti event:', error);
      api.sendMessage('An error occurred while processing the leave notification.', event.threadID);
    }
  },
};
