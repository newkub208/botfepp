module.exports = {
  name: "ลบ",
  description: "ลบข้อความของบอทโดยการตอบกลับ",
  version: "1.0.0",
  aliases: ["unsend", "delete"],
  nashPrefix: false,
  cooldowns: 0,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, type, messageReply } = event;

    // --- 1. ตรวจสอบว่าเป็นการตอบกลับข้อความหรือไม่ ---
    if (type !== "message_reply") {
      return api.sendMessage(
        "คำสั่งนี้ต้องใช้โดยการตอบกลับ (reply) ข้อความของบอทครับ",
        threadID,
        messageID
      );
    }

    // --- 2. ตรวจสอบว่าข้อความที่ตอบกลับเป็นของบอทหรือไม่ ---
    if (messageReply.senderID !== api.getCurrentUserID()) {
      return api.sendMessage(
        "ทำได้เพียงลบข้อความของบอทเท่านั้นครับ กรุณาตอบกลับข้อความของบอท",
        threadID,
        messageID
      );
    }

    // --- 3. ทำการลบข้อความ ---
    try {
      await api.unsendMessage(messageReply.messageID);
      // อาจจะลบข้อความคำสั่งของผู้ใช้ด้วยเพื่อความสะอาด
      api.unsendMessage(messageID); 
    } catch (err) {
      console.error("Unsend command error:", err);
      api.sendMessage("❌ เกิดข้อผิดพลาด ไม่สามารถลบข้อความได้", threadID, messageID);
    }
  }
};
