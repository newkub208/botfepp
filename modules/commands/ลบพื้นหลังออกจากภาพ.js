const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- สร้างโฟลเดอร์ cache หากยังไม่มี ---
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

module.exports = {
  name: "ลบพื้นหลัง",
  description: "ลบพื้นหลังออกจากรูปภาพโดยการตอบกลับ",
  version: "1.2.0", // อัปเดตเวอร์ชัน
  aliases: ["removebg", "ลบbg"],
  nashPrefix: false,
  cooldowns: 15,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, type, messageReply } = event;

    // --- ตรวจสอบว่าเป็นการตอบกลับข้อความหรือไม่ ---
    if (type !== "message_reply") {
      return api.sendMessage(
        "กรุณาตอบกลับ (reply) รูปภาพที่คุณต้องการลบพื้นหลัง แล้วใช้คำสั่งนี้อีกครั้งครับ",
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
    const waitingMessage = await api.sendMessage("⏳ กำลังประมวลผลรูปภาพของคุณ โปรดรอสักครู่...", threadID);

    try {
      // --- เรียก API เพื่อลบพื้นหลัง ---
      const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const apiUrl = `https://kaiz-apis.gleeze.com/api/removebg?url=${encodeURIComponent(imageUrlToProcess)}&apikey=${apiKey}`;
      
      const response = await axios.get(apiUrl, { 
          timeout: 90000,
          // เพิ่มการตรวจสอบสถานะเพื่อจัดการกับ error code 400
          validateStatus: function (status) {
            return status < 500; // ยอมรับ status code ที่น้อยกว่า 500
          }
      });
      const responseData = response.data;

      // [FIXED] เปลี่ยนไปตรวจสอบ 'url' ตามที่ API ส่งกลับมาจริงๆ
      const resultImageUrl = responseData.url || responseData.image_url || responseData.imageurl;
      
      if (!resultImageUrl) {
        console.error("API Response:", responseData);
        // แสดง error ที่ได้รับจาก API โดยตรงถ้ามี
        const apiError = responseData.error || "ไม่สามารถดึงลิงก์รูปภาพจาก API ได้";
        throw new Error(apiError);
      }

      // --- กำหนดชื่อและที่อยู่ของไฟล์ที่จะบันทึก ---
      const fileName = `removedbg_${Date.now()}.png`;
      const filePath = path.join(CACHE_DIR, fileName);
      const writer = fs.createWriteStream(filePath);

      // --- เริ่มดาวน์โหลดรูปภาพที่ลบพื้นหลังแล้ว ---
      const imageStreamRes = await axios({
        url: resultImageUrl,
        method: 'GET',
        responseType: 'stream'
      });

      imageStreamRes.data.pipe(writer);

      // --- จัดการเมื่อดาวน์โหลดเสร็จสิ้น ---
      writer.on("finish", () => {
        api.sendMessage({
          body: `✅ ลบพื้นหลังสำเร็จแล้วครับ!`,
          attachment: fs.createReadStream(filePath)
        }, threadID, () => {
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
      console.error("❌ RemoveBG API Error:", err.message);
      api.sendMessage(`❌ เกิดข้อผิดพลาดในการลบพื้นหลัง: ${err.message}`, threadID, messageID);
    } finally {
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};
