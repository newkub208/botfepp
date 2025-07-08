const newMemberMonitor = require('../events/newMemberMonitor.js');

module.exports = {
  name: "ระบบเตะใหม่",
  aliases: ["เตะใหม่", "newkick", "automemberkick"],
  description: "จัดการระบบเตะสมาชิกใหม่ที่ไม่พูดคุยใน 10 นาที",
  version: "1.0.0",
  nashPrefix: false,
  cooldowns: 5,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, senderID } = event;

    try {
      // ตรวจสอบสิทธิ์แอดมิน
      const threadInfo = await api.getThreadInfo(threadID);
      const adminIDs = threadInfo.adminIDs.map(admin => admin.id);
      const specialUserID = "61574221880222"; // ID ผู้ใช้พิเศษ

      if (!adminIDs.includes(senderID) && senderID !== specialUserID) {
        return api.sendMessage("❌ คำสั่งนี้สำหรับผู้ดูแลกลุ่มเท่านั้น", threadID, messageID);
      }

      const command = args[0]?.toLowerCase();

      if (!command) {
        const helpMessage = `📋 ระบบเตะสมาชิกใหม่อัตโนมัติ

🔸 ใช้คำสั่ง:
• ${prefix}เตะใหม่ สถานะ - ดูรายชื่อสมาชิกใหม่ที่รอเวลา
• ${prefix}เตะใหม่ ล้าง - ล้างข้อมูลสมาชิกใหม่ทั้งหมด
• ${prefix}เตะใหม่ ข้อมูล - ดูข้อมูลการทำงานของระบบ

⚠️ ระบบจะเตะสมาชิกใหม่ที่ไม่พูดคุยภายใน 10 นาทีอัตโนมัติ`;

        return api.sendMessage(helpMessage, threadID, messageID);
      }

      switch (command) {
        case "สถานะ":
        case "status":
          const members = newMemberMonitor.getNewMembersStatus();
          const filteredMembers = members.filter(member => member.threadID === threadID);

          if (filteredMembers.length === 0) {
            return api.sendMessage("✅ ไม่มีสมาชิกใหม่ที่รอเวลาในขณะนี้", threadID, messageID);
          }

          let statusMessage = "⏰ รายชื่อสมาชิกใหม่ที่รอเวลา:\n\n";
          for (const member of filteredMembers) {
            statusMessage += `👤 ${member.userName}\n`;
            statusMessage += `⏱️ เหลือเวลา: ${member.timeLeftMinutes} นาที\n`;
            statusMessage += `📅 เข้าร่วมเมื่อ: ${new Date(member.joinTime).toLocaleString('th-TH')}\n\n`;
          }

          return api.sendMessage(statusMessage, threadID, messageID);

        case "ล้าง":
        case "clear":
          newMemberMonitor.clearNewMembersData();
          return api.sendMessage("✅ ล้างข้อมูลสมาชิกใหม่ทั้งหมดเรียบร้อยแล้ว", threadID, messageID);

        case "ข้อมูล":
        case "info":
          const infoMessage = `ℹ️ ข้อมูลระบบเตะสมาชิกใหม่

🔸 การทำงาน:
• ตรวจสอบสมาชิกใหม่ทุก 30 วินาที
• เตะออกหากไม่พูดคุยภายใน 10 นาที
• ไม่เตะแอดมินกลุ่ม
• ไม่เตะบอท

🔸 เงื่อนไข:
• สมาชิกต้องส่งข้อความอย่างน้อย 1 ครั้ง
• การตอบกลับ รีแอคต์ หรือสติกเกอร์ ถือเป็นการพูดคุย
• ระบบจะแจ้งเตือนเมื่อเตะสมาชิก

⚙️ พัฒนาโดย: joshuaApostol`;

          return api.sendMessage(infoMessage, threadID, messageID);

        default:
          return api.sendMessage("❌ คำสั่งไม่ถูกต้อง ใช้คำสั่งโดยไม่มีพารามิเตอร์เพื่อดูคำแนะนำ", threadID, messageID);
      }

    } catch (error) {
      console.error('Error in auto member kick command:', error);
      return api.sendMessage("❌ เกิดข้อผิดพลาดในการดำเนินการ", threadID, messageID);
    }
  }
};
