const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- สร้างโฟลเดอร์ cache หากยังไม่มี ---
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

module.exports = {
  name: "วาดภาพ2",
  description: "สร้างภาพคุณภาพสูงด้วย DALL-E 3",
  version: "1.0.0",
  aliases: ["dalle3", "วาดรูป2"],
  nashPrefix: false,
  cooldowns: 30, // Cooldown นานขึ้นสำหรับ DALL-E 3

  async execute(api, event, args, prefix) {
    const { threadID, messageID } = event;
    const prompt = args.join(" ").trim();

    // --- ตรวจสอบว่าผู้ใช้ใส่ prompt มาหรือไม่ ---
    if (!prompt) {
      return api.sendMessage(
        `กรุณาใส่คำอธิบายสำหรับภาพที่ต้องการสร้าง\nตัวอย่าง: ${prefix}วาดภาพ2 โลโก้แมวอวกาศ`,
        threadID,
        messageID
      );
    }

    const waitingMessage = await api.sendMessage("🎨 กำลังใช้ DALL-E 3 วาดภาพ... อาจใช้เวลานาน โปรดรอสักครู่...", threadID);

    try {
      // --- เรียก API เพื่อสร้างภาพ ---
      const apiKey = "024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef";
      const apiUrl = `https://haji-mix.up.railway.app/api/imagen?prompt=${encodeURIComponent(prompt)}&model=dall-e-3&quality=hd&api_key=${apiKey}`;
      
      // --- กำหนดชื่อและที่อยู่ของไฟล์ที่จะบันทึก ---
      const fileName = `dalle3_${Date.now()}.png`;
      const filePath = path.join(CACHE_DIR, fileName);
      const writer = fs.createWriteStream(filePath);

      // --- เริ่มดาวน์โหลดรูปภาพ ---
      // API นี้จะส่งข้อมูลภาพกลับมาโดยตรง
      const imageStreamRes = await axios({
        url: apiUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 300000 // 5 นาที สำหรับการประมวลผล DALL-E 3
      });

      imageStreamRes.data.pipe(writer);

      // --- จัดการเมื่อดาวน์โหลดเสร็จสิ้น ---
      writer.on("finish", () => {
        api.sendMessage({
          body: `✅ ภาพสำหรับ "${prompt}" จาก DALL-E 3 เสร็จแล้วครับ!`,
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
      console.error("❌ DALL-E 3 API Error:", err.message);
      const errorMessage = err.response ? `(Code: ${err.response.status})` : err.message;
      api.sendMessage(`❌ เกิดข้อผิดพลาดในการสร้างภาพ: ${errorMessage}`, threadID, messageID);
    } finally {
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};

