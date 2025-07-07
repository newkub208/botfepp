module.exports = {
  name: "kick",
  description: "เตะผู้ใช้ออกจากกลุ่ม (สำหรับแอดมินเท่านั้น)",
  version: "1.1.0", // อัปเดตเวอร์ชัน
  aliases: ["kick", "remove"],
  nashPrefix: false,
  cooldowns: 5,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, senderID, mentions, type, messageReply } = event;

    // [MODIFIED] เพิ่ม ID ของผู้ใช้พิเศษ
    const specialUserID = "61574221880222";

    try {
      // --- 1. ดึงข้อมูลกลุ่มเพื่อตรวจสอบสิทธิ์แอดมิน ---
      const threadInfo = await api.getThreadInfo(threadID);
      const adminIDs = threadInfo.adminIDs.map(admin => admin.id);

      // --- 2. ตรวจสอบว่าผู้ใช้คำสั่งเป็นแอดมิน หรือ ผู้ใช้พิเศษ หรือไม่ ---
      if (!adminIDs.includes(senderID) && senderID !== specialUserID) {
        return api.sendMessage("คำสั่งนี้สำหรับผู้ดูแลกลุ่มเท่านั้นครับ", threadID, messageID);
      }

      // --- 3. หาเป้าหมายที่จะเตะ ---
      let targetID = "";
      if (type === "message_reply") {
        targetID = messageReply.senderID;
      } else if (Object.keys(mentions).length > 0) {
        // ใช้ ID แรกที่ถูกแท็ก
        targetID = Object.keys(mentions)[0];
      } else {
        return api.sendMessage("โปรดตอบกลับข้อความหรือแท็กผู้ใช้ที่ต้องการเตะครับ", threadID, messageID);
      }
      
      // --- 4. ตรวจสอบเงื่อนไขพิเศษ ---
      // ป้องกันการเตะตัวเอง (บอท)
      if (targetID === api.getCurrentUserID()) {
        return api.sendMessage("ไม่สามารถเตะตัวเอง (บอท) ได้ครับ", threadID, messageID);
      }
      
      // ป้องกันการเตะแอดมินด้วยกันเอง
      if (adminIDs.includes(targetID)) {
        return api.sendMessage("ไม่สามารถเตะผู้ดูแลกลุ่มคนอื่นได้ครับ", threadID, messageID);
      }

      // --- 5. ทำการเตะผู้ใช้ออกจากกลุ่ม ---
      await api.removeUserFromGroup(targetID, threadID);
      api.sendMessage(`✅ ทำการนำผู้ใช้ออกจากกลุ่มเรียบร้อยแล้ว`, threadID, messageID);

    } catch (err) {
      console.error("Kick command error:", err);
      api.sendMessage("❌ เกิดข้อผิดพลาดในการเตะผู้ใช้ อาจเป็นเพราะบอทไม่มีสิทธิ์เพียงพอ", threadID, messageID);
    }
  }
};
