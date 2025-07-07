const axios = require("axios");
const fs =require("fs");
const path = require("path");

// --- สร้างโฟลเดอร์ cache หากยังไม่มี ---
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

module.exports = {
  name: "วาดภาพ3",
  description: "สร้างภาพแนวอาร์ตด้วย Pollination AI",
  version: "1.0.0",
  aliases: ["pollination", "วาดรูป3"],
  nashPrefix: false,
  cooldowns: 30, // Cooldown นานขึ้นสำหรับ AI สร้างภาพ

  async execute(api, event, args, prefix) {
    const { threadID, messageID } = event;
    const prompt = args.join(" ").trim();

    // --- ตรวจสอบว่าผู้ใช้ใส่ prompt มาหรือไม่ ---
    if (!prompt) {
      return api.sendMessage(
        `กรุณาใส่คำอธิบายสำหรับภาพที่ต้องการสร้าง\nตัวอย่าง: ${prefix}วาดภาพ3 สาวอนิเมะในชุดเกราะซามูไร`,
        threadID,
        messageID
      );
    }

    const waitingMessage = await api.sendMessage("🎨 กำลังใช้ Pollination AI วาดภาพ... โปรดรอสักครู่...", threadID);

    try {
      // --- เรียก API เพื่อสร้างภาพ ---
      const apiKey = "024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef";
      // ตั้งค่าพื้นฐานสำหรับขนาดและคุณภาพของภาพ
      const width = 1024;
      const height = 1024; // สามารถปรับเปลี่ยนได้ตามต้องการ
      const seed = Date.now(); // ใช้ seed แบบสุ่มเพื่อให้ได้ภาพไม่ซ้ำ

      const apiUrl = `https://haji-mix.up.railway.app/api/pollination?prompt=${encodeURIComponent(prompt)}&width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true&enhance=false&api_key=${apiKey}`;
      
      // --- กำหนดชื่อและที่อยู่ของไฟล์ที่จะบันทึก ---
      const fileName = `pollination_${Date.now()}.png`;
      const filePath = path.join(CACHE_DIR, fileName);
      const writer = fs.createWriteStream(filePath);

      // --- เริ่มดาวน์โหลดรูปภาพ ---
      // API นี้จะส่งข้อมูลภาพกลับมาโดยตรง
      const imageStreamRes = await axios({
        url: apiUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 300000 // 5 นาที สำหรับการประมวลผล
      });

      imageStreamRes.data.pipe(writer);

      // --- จัดการเมื่อดาวน์โหลดเสร็จสิ้น ---
      writer.on("finish", () => {
        api.sendMessage({
          body: `✅ ภาพสำหรับ "${prompt}" จาก Pollination AI เสร็จแล้วครับ!`,
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
      console.error("❌ Pollination API Error:", err.message);
      const errorMessage = err.response ? `(Code: ${err.response.status})` : err.message;
      api.sendMessage(`❌ เกิดข้อผิดพลาดในการสร้างภาพ: ${errorMessage}`, threadID, messageID);
    } finally {
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};

