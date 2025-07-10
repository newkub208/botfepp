const webServerManager = require('../../utils/webServerManager');

module.exports = {
  name: 'เว็บสถานะ',
  description: 'ตรวจสอบสถานะเว็บไซต์ที่กำลังรัน',
  usage: '[nashPrefix]เว็บสถานะ',
  nashPrefix: true,
  aliases: ['webstatus', 'webcheck'],
  execute: async (api, event, args, prefix) => {
    const { threadID, messageID, senderID } = event;

    const serverKey = `${threadID}_${senderID}`;
    
    let statusMessage = '📊 สถานะเซิร์ฟเวอร์เว็บ\n';
    statusMessage += '═══════════════════\n\n';
    
    if (webServerManager.hasServer(serverKey)) {
      const serverInfo = webServerManager.getServerInfo(serverKey);
      
      if (serverInfo && !serverInfo.isExpired) {
        const hoursRemaining = Math.floor(serverInfo.remaining / (1000 * 60 * 60));
        const minutesRemaining = Math.floor((serverInfo.remaining % (1000 * 60 * 60)) / (1000 * 60));
        
        statusMessage += '🟢 เซิร์ฟเวอร์: กำลังทำงาน\n';
        statusMessage += `🌐 URL: ${serverInfo.url}\n`;
        statusMessage += `🕐 เริ่มต้น: ${serverInfo.startTime.toLocaleString('th-TH')}\n`;
        statusMessage += `⏰ เหลือเวลา: ${hoursRemaining} ชั่วโมง ${minutesRemaining} นาที\n\n`;
        statusMessage += '💡 ใช้คำสั่ง `/หยุดเว็บ` เพื่อหยุดเซิร์ฟเวอร์';
      } else {
        // Server expired, clean it up
        webServerManager.removeServer(serverKey);
        statusMessage += '🔴 เซิร์ฟเวอร์: หมดอายุแล้ว\n';
        statusMessage += '💡 ใช้คำสั่ง `/รันเว็บ [pastebin_url]` เพื่อเริ่มเซิร์ฟเวอร์ใหม่';
      }
    } else {
      statusMessage += '🔴 เซิร์ฟเวอร์: ไม่ทำงาน\n';
      statusMessage += '💡 ใช้คำสั่ง `/รันเว็บ [pastebin_url]` เพื่อเริ่มเซิร์ฟเวอร์';
    }

    // Show total active servers
    const totalServers = webServerManager.getServerCount();
    if (totalServers > 0) {
      statusMessage += `\n\n📈 เซิร์ฟเวอร์ทั้งหมด: ${totalServers} ตัว`;
    }
    
    await api.sendMessage(statusMessage, threadID, messageID);
  }
};
