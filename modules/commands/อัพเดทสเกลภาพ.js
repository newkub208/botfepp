const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- สร้างโฟลเดอร์ cache หากยังไม่มี ---
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

module.exports = {
  name: "อัพสเกล",
  description: "เพิ่มความละเอียดของรูปภาพให้คมชัดขึ้นโดยการตอบกลับ",
  version: "1.0.0",
  aliases: ["upscale", "hd", "เพิ่มความชัด"],
  nashPrefix: false,
  cooldowns: 25, // Cooldown นานขึ้นสำหรับการประมวลผลภาพความละเอียดสูง

  async execute(api, event, args, prefix) {
    const { threadID, messageID, type, messageReply } = event;

    // --- ตรวจสอบว่าเป็นการตอบกลับข้อความหรือไม่ ---
    if (type !== "message_reply") {
      return api.sendMessage(
        "กรุณาตอบกลับ (reply) รูปภาพที่คุณต้องการเพิ่มความละเอียด แล้วใช้คำสั่งนี้อีกครั้งครับ",
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

    const imageUrlToProcess = imageAttachment.url;
    const waitingMessage = await api.sendMessage("⏳ กำลังเพิ่มความละเอียดให้ภาพ โปรดรอสักครู่ อาจใช้เวลานานกว่าปกติ...", threadID);

    try {
      // --- เรียก API เพื่ออัพสเกลภาพ ---
      const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const apiUrl = `https://kaiz-apis.gleeze.com/api/upscale-v2?url=${encodeURIComponent(imageUrlToProcess)}&apikey=${apiKey}`;
      
      // --- กำหนดชื่อและที่อยู่ของไฟล์ที่จะบันทึก ---
      const fileName = `upscaled_${Date.now()}.png`;
      const filePath = path.join(CACHE_DIR, fileName);
      const writer = fs.createWriteStream(filePath);

      // --- เริ่มดาวน์โหลดรูปภาพที่อัพสเกลแล้ว ---
      // API นี้จะส่งข้อมูลภาพกลับมาโดยตรง ไม่ใช่ JSON
      const imageStreamRes = await axios({
        url: apiUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 300000 // 5 นาที สำหรับการประมวลผลภาพขนาดใหญ่
      });

      imageStreamRes.data.pipe(writer);

      // --- จัดการเมื่อดาวน์โหลดเสร็จสิ้น ---
      writer.on("finish", () => {
        api.sendMessage({
          body: `✅ เพิ่มความละเอียดภาพสำเร็จแล้วครับ!`,
          attachment: fs.createReadStream(filePath)
        }, threadID, () => {
          // ลบไฟล์รูปภาพออกจาก cache หลังจากส่งสำเร็จ
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, messageID);
      });

      // --- จัดการเมื่อเกิดข้อผิดพลาดระหว่างดาวน์โหลด ---
      writer.on("error", (err) => {
        console.error("❌ Error writing image file:", err);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการบันทึกรูปภาพ", threadID, messageID);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

    } catch (err) {
      console.error("❌ Upscale API Error:", err.message);
      const errorMessage = err.response ? `(Code: ${err.response.status})` : err.message;
      api.sendMessage(`❌ เกิดข้อผิดพลาดในการอัพสเกลภาพ: ${errorMessage}`, threadID, messageID);
    } finally {
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};
