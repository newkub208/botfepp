const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- สร้างโฟลเดอร์ cache หากยังไม่มี ---
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// [NEW] สร้าง object สำหรับแปลงคำสั่งภาษาไทยเป็นภาษาอังกฤษ
const effectMap = {
  'ดำ': 'grayscale',
  'ขาวดำ': 'grayscale',
  'เทา': 'grayscale'
  // สามารถเพิ่มเอฟเฟกต์อื่นๆ ที่นี่ได้ในอนาคต เช่น 'สว่าง': 'brightness'
};

module.exports = {
  name: "ปรับสีภาพ",
  description: "ปรับสีรูปภาพด้วยเอฟเฟกต์ต่างๆ โดยการตอบกลับรูปภาพ",
  version: "1.0.0",
  aliases: ["adjustcolor", "ปรับสี"],
  nashPrefix: false,
  cooldowns: 15,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, type, messageReply } = event;

    const userEffect = args[0]?.toLowerCase();

    // --- ตรวจสอบว่าผู้ใช้ระบุเอฟเฟกต์มาหรือไม่ ---
    if (!userEffect) {
      const helpMessage = `กรุณาระบุเอฟเฟกต์ที่ต้องการ\n\nตัวอย่าง: ${prefix}ปรับสีภาพ ดำ\n(โดยตอบกลับรูปภาพที่ต้องการแก้ไข)`;
      return api.sendMessage(helpMessage, threadID, messageID);
    }
    
    // --- แปลงคำสั่งภาษาไทยเป็นภาษาอังกฤษ ---
    const apiEffect = effectMap[userEffect];

    if (!apiEffect) {
        const helpMessage = `ไม่รู้จักเอฟเฟกต์ "${userEffect}"\n\nเอฟเฟกต์ที่ใช้ได้ตอนนี้คือ:\n- ดำ (หรือ ขาวดำ)`;
        return api.sendMessage(helpMessage, threadID, messageID);
    }

    // --- ตรวจสอบว่าเป็นการตอบกลับข้อความและมีรูปภาพหรือไม่ ---
    if (type !== "message_reply") {
      return api.sendMessage("คำสั่งนี้ต้องใช้โดยการตอบกลับ (reply) รูปภาพครับ", threadID, messageID);
    }

    const imageAttachment = messageReply?.attachments?.find(att => att.type === "photo");
    if (!imageAttachment) {
      return api.sendMessage("ไม่พบรูปภาพในข้อความที่คุณตอบกลับครับ", threadID, messageID);
    }

    const imageUrl = imageAttachment.url;
    const waitingMessage = await api.sendMessage(`🎨 กำลังปรับสีภาพเป็น "${userEffect}"...`, threadID);

    try {
      // --- เรียก API เพื่อแก้ไขรูปภาพ ---
      const apiKey = "024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef";
      const apiUrl = `https://haji-mix.up.railway.app/api/editimg?url=${encodeURIComponent(imageUrl)}&effect=${apiEffect}&api_key=${apiKey}`;
      
      // --- กำหนดชื่อและที่อยู่ของไฟล์ที่จะบันทึก ---
      const fileName = `adjusted_${apiEffect}_${Date.now()}.png`;
      const filePath = path.join(CACHE_DIR, fileName);
      const writer = fs.createWriteStream(filePath);

      // --- เริ่มดาวน์โหลดรูปภาพที่แก้ไขแล้ว ---
      const imageStreamRes = await axios({
        url: apiUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 180000 // 3 นาที
      });

      imageStreamRes.data.pipe(writer);

      // --- จัดการเมื่อดาวน์โหลดเสร็จสิ้น ---
      writer.on("finish", () => {
        api.sendMessage({
          body: `✅ ปรับสีภาพเป็น "${userEffect}" สำเร็จแล้วครับ!`,
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
      console.error("❌ Adjust Color API Error:", err.message);
      const errorMessage = err.response ? `(Code: ${err.response.status})` : err.message;
      api.sendMessage(`❌ เกิดข้อผิดพลาดในการปรับสีภาพ: ${errorMessage}`, threadID, messageID);
    } finally {
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};

