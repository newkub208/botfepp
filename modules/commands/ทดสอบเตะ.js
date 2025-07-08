const newMemberMonitor = require('../events/newMemberMonitor.js');

module.exports = {
  name: "เตะผู้ใช้ใหม่",
  aliases: ["testkick", "testautokick"],
  description: "ทดสอบระบบเตะสมาชิกใหม่ (สำหรับผู้พัฒนา)",
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
        const helpMessage = `🧪 คำสั่งทดสอบระบบเตะสมาชิกใหม่

🔸 ใช้คำสั่ง:
• ${prefix}ทดสอบเตะ เพิ่ม @user - จำลองการเข้าร่วมของผู้ใช้
• ${prefix}ทดสอบเตะ ลบ @user - ลบผู้ใช้จากระบบรอ
• ${prefix}ทดสอบเตะ เวลา @user 1 - ตั้งเวลาเหลือ 1 นาที
• ${prefix}ทดสอบเตะ ตรวจ - ตรวจสอบสมาชิกหมดเวลาทันที

⚠️ ใช้สำหรับทดสอบเท่านั้น`;

        return api.sendMessage(helpMessage, threadID, messageID);
      }

      const mentions = Object.keys(event.mentions || {});

      switch (command) {
        case "เพิ่ม":
        case "add":
          if (mentions.length === 0) {
            return api.sendMessage("❌ กรุณาแท็กผู้ใช้ที่ต้องการเพิ่มเข้าระบบ", threadID, messageID);
          }

          for (const userID of mentions) {
            const memberKey = `${threadID}_${userID}`;
            const userInfo = await api.getUserInfo(userID);
            const userName = userInfo[userID]?.name || 'ผู้ใช้ทดสอบ';

            // เพิ่มเข้าระบบ
            newMemberMonitor.newMembersData = newMemberMonitor.newMembersData || new Map();
            newMemberMonitor.newMembersData.set(memberKey, {
              userID: userID,
              threadID: threadID,
              userName: userName,
              joinTime: Date.now()
            });

            // บันทึกข้อมูล
            if (typeof newMemberMonitor.saveNewMembersData === 'function') {
              newMemberMonitor.saveNewMembersData();
            }
          }

          return api.sendMessage(`✅ เพิ่มผู้ใช้ ${mentions.length} คนเข้าระบบทดสอบแล้ว`, threadID, messageID);

        case "ลบ":
        case "remove":
          if (mentions.length === 0) {
            return api.sendMessage("❌ กรุณาแท็กผู้ใช้ที่ต้องการลบจากระบบ", threadID, messageID);
          }

          let removedCount = 0;
          for (const userID of mentions) {
            const memberKey = `${threadID}_${userID}`;
            if (newMemberMonitor.newMembersData && newMemberMonitor.newMembersData.has(memberKey)) {
              newMemberMonitor.newMembersData.delete(memberKey);
              removedCount++;
            }
          }

          if (typeof newMemberMonitor.saveNewMembersData === 'function') {
            newMemberMonitor.saveNewMembersData();
          }

          return api.sendMessage(`✅ ลบผู้ใช้ ${removedCount} คนจากระบบแล้ว`, threadID, messageID);

        case "เวลา":
        case "time":
          if (mentions.length === 0 || !args[2]) {
            return api.sendMessage("❌ ใช้: ทดสอบเตะ เวลา @user [จำนวนนาที]", threadID, messageID);
          }

          const minutes = parseInt(args[2]);
          if (isNaN(minutes) || minutes < 0) {
            return api.sendMessage("❌ จำนวนนาทีต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0", threadID, messageID);
          }

          for (const userID of mentions) {
            const memberKey = `${threadID}_${userID}`;
            if (newMemberMonitor.newMembersData && newMemberMonitor.newMembersData.has(memberKey)) {
              const memberData = newMemberMonitor.newMembersData.get(memberKey);
              // ตั้งเวลาให้เหลือตามที่กำหนด
              memberData.joinTime = Date.now() - (10 * 60 * 1000) + (minutes * 60 * 1000);
              newMemberMonitor.newMembersData.set(memberKey, memberData);
            }
          }

          if (typeof newMemberMonitor.saveNewMembersData === 'function') {
            newMemberMonitor.saveNewMembersData();
          }

          return api.sendMessage(`✅ ตั้งเวลาเหลือ ${minutes} นาทีสำหรับผู้ใช้ที่แท็กแล้ว`, threadID, messageID);

        case "ตรวจ":
        case "check":
          // เรียกใช้ฟังก์ชันตรวจสอบทันที
          if (typeof newMemberMonitor.checkExpiredMembers === 'function') {
            await newMemberMonitor.checkExpiredMembers(api);
            return api.sendMessage("✅ ตรวจสอบสมาชิกหมดเวลาเรียบร้อยแล้ว", threadID, messageID);
          } else {
            return api.sendMessage("❌ ไม่สามารถเรียกใช้ฟังก์ชันตรวจสอบได้", threadID, messageID);
          }

        default:
          return api.sendMessage("❌ คำสั่งไม่ถูกต้อง ใช้คำสั่งโดยไม่มีพารามิเตอร์เพื่อดูคำแนะนำ", threadID, messageID);
      }

    } catch (error) {
      console.error('Error in test auto kick command:', error);
      return api.sendMessage("❌ เกิดข้อผิดพลาดในการทดสอบ", threadID, messageID);
    }
  }
};
