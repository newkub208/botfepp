const axios = require("axios");

module.exports = {
  name: "อัพภาพ",
  description: "อัพโหลดรูปภาพขึ้นโฮสต์โดยการตอบกลับรูปภาพ",
  version: "1.0.0",
  aliases: ["upload", "hostimg", "อัพรูป"],
  nashPrefix: false,
  cooldowns: 10,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, type, messageReply } = event;

    // --- ตรวจสอบว่าเป็นการตอบกลับข้อความหรือไม่ ---
    if (type !== "message_reply") {
      return api.sendMessage(
        "กรุณาตอบกลับ (reply) รูปภาพที่คุณต้องการอัพโหลด แล้วใช้คำสั่งนี้อีกครั้งครับ",
        threadID,
        messageID
      );
    }

    // --- ตรวจสอบว่าข้อความที่ตอบกลับมีไฟล์แนบหรือไม่ ---
    if (!messageReply || !messageReply.attachments || messageReply.attachments.length === 0) {
      return api.sendMessage(
        "ไม่พบไฟล์แนบในข้อความที่คุณตอบกลับ กรุณาตอบกลับรูปภาพครับ",
        threadID,
        messageID
      );
    }

    // --- ค้นหาไฟล์แนบที่เป็นรูปภาพ ---
    const imageAttachment = messageReply.attachments.find(att => att.type === "photo");

    if (!imageAttachment) {
      return api.sendMessage(
        "ไฟล์แนบที่คุณตอบกลับไม่ใช่รูปภาพ กรุณาลองใหม่ครับ",
        threadID,
        messageID
      );
    }

    const imageUrl = imageAttachment.url;
    const waitingMessage = await api.sendMessage("⏳ กำลังอัพโหลดรูปภาพของคุณ โปรดรอสักครู่...", threadID);

    try {
      // --- เรียก API เพื่ออัพโหลดรูปภาพ ---
      const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const apiUrl = `https://kaiz-apis.gleeze.com/api/freeimagehost?imageUrl=${encodeURIComponent(imageUrl)}&apikey=${apiKey}`;
      
      const response = await axios.get(apiUrl, { timeout: 60000 });
      const responseData = response.data;

      // --- ตรวจสอบว่า API ส่งข้อมูลที่ถูกต้องกลับมาหรือไม่ ---
      // สมมติว่า URL ที่ได้กลับมาอยู่ใน property ชื่อ 'url'
      if (!responseData || !responseData.url) {
        throw new Error("ไม่สามารถดึงลิงก์รูปภาพจาก API ได้ หรือ API มีปัญหา");
      }

      const hostedUrl = responseData.url;
      
      api.sendMessage(
        `✅ อัพโหลดสำเร็จ!\n\n🔗 ลิงก์รูปภาพของคุณ:\n${hostedUrl}`,
        threadID,
        messageID
      );

    } catch (err) {
      console.error("❌ Image Upload API Error:", err.message);
      const errorMessage = err.response ? JSON.stringify(err.response.data) : err.message;
      api.sendMessage(`❌ เกิดข้อผิดพลาดในการอัพโหลด: ${errorMessage}`, threadID, messageID);
    } finally {
        // ลบข้อความ "กำลังอัพโหลด..."
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};
