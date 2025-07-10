const { exec } = require('child_process');
const webServerManager = require('../../utils/webServerManager');

module.exports = {
  name: 'หยุดเว็บ',
  description: 'หยุดเซิร์ฟเวอร์เว็บที่กำลังทำงานบนพอร์ต 6666',
  usage: '[nashPrefix]หยุดเว็บ',
  nashPrefix: true,
  aliases: ['stopweb', 'webstop'],
  execute: async (api, event, args, prefix) => {
    const { threadID, messageID, senderID } = event;

    const serverKey = `${threadID}_${senderID}`;

    // Try to stop server using the manager first
    if (webServerManager.hasServer(serverKey)) {
      const success = webServerManager.removeServer(serverKey);
      if (success) {
        await api.sendMessage(
          '✅ หยุดเซิร์ฟเวอร์เว็บสำเร็จ!\n\n' +
          '� เซิร์ฟเวอร์: หยุดทำงาน\n' +
          '🌐 พอร์ต 6666: ว่าง\n\n' +
          '💡 ใช้คำสั่ง `/รันเว็บ [pastebin_url]` เพื่อเริ่มเซิร์ฟเวอร์ใหม่',
          threadID, messageID
        );
        return;
      }
    }

    await api.sendMessage('�🔄 กำลังค้นหาและหยุดเซิร์ฟเวอร์เว็บ...', threadID, messageID);

    try {
      // Find and kill processes using port 6666 as fallback
      exec('lsof -ti:6666', (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
          api.sendMessage(
            '💡 ไม่พบเซิร์ฟเวอร์ที่ทำงานบนพอร์ต 6666\n' +
            'เซิร์ฟเวอร์อาจหยุดทำงานแล้ว หรือไม่ได้เริ่มต้น',
            threadID, messageID
          );
          return;
        }

        const pids = stdout.trim().split('\n');
        let killedCount = 0;
        const totalPids = pids.filter(p => p).length;

        pids.forEach(pid => {
          if (pid) {
            exec(`kill -9 ${pid}`, (killError) => {
              if (!killError) {
                killedCount++;
              }
              
              // Check if all processes have been handled
              if (killedCount > 0 && killedCount === totalPids) {
                api.sendMessage(
                  '✅ หยุดเซิร์ฟเวอร์เว็บสำเร็จ!\n\n' +
                  '🔴 เซิร์ฟเวอร์: หยุดทำงาน\n' +
                  '🌐 พอร์ต 6666: ว่าง\n\n' +
                  '💡 ใช้คำสั่ง `/รันเว็บ [pastebin_url]` เพื่อเริ่มเซิร์ฟเวอร์ใหม่',
                  threadID
                );
              } else if (killedCount === 0 && totalPids === 1) {
                api.sendMessage(
                  '❌ ไม่สามารถหยุดเซิร์ฟเวอร์ได้\n' +
                  'อาจต้องสิทธิ์ admin หรือเซิร์ฟเวอร์กำลังใช้งานโดยโปรเซสอื่น',
                  threadID
                );
              }
            });
          }
        });
      });

    } catch (error) {
      console.error('Error stopping web server:', error);
      await api.sendMessage(
        `❌ เกิดข้อผิดพลาดในการหยุดเซิร์ฟเวอร์: ${error.message}`,
        threadID, messageID
      );
    }
  }
};
