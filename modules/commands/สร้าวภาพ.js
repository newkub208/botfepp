const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- สร้างโฟลเดอร์ cache หากยังไม่มี ---
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

module.exports = {
  name: "สร้างภาพ",
  description: "สร้างภาพจากข้อความโดยใช้ AI",
  version: "1.0.0",
  aliases: ["genimg", "imageai", "วาดรูป"],
  nashPrefix: false,
  cooldowns: 20, // Cooldown นานขึ้นเล็กน้อยสำหรับ AI สร้างภาพ

  async execute(api, event, args, prefix) {
    const { threadID, messageID } = event;
    const prompt = args.join(" ").trim();

    // --- ตรวจสอบว่าผู้ใช้ใส่ prompt มาหรือไม่ ---
    if (!prompt) {
      return api.sendMessage(
        `กรุณาใส่คำอธิบายสำหรับภาพที่ต้องการสร้าง\nตัวอย่าง: ${prefix}สร้างภาพ แมวนักบินอวกาศบนดวงจันทร์`,
        threadID,
        messageID
      );
    }

    const waitingMessage = await api.sendMessage("🎨 AI กำลังวาดภาพให้คุณ โปรดรอสักครู่...", threadID);

    try {
      // --- เรียก API เพื่อสร้างภาพ ---
      const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const apiUrl = `https://kaiz-apis.gleeze.com/api/flux-realtime?prompt=${encodeURIComponent(prompt)}&stream=false&apikey=${apiKey}`;
      
      const infoRes = await axios.get(apiUrl, { timeout: 180000 }); // เพิ่ม timeout เป็น 3 นาที
      const imageInfo = infoRes.data;

      // --- ตรวจสอบว่า API ส่งข้อมูลที่ถูกต้องกลับมาหรือไม่ ---
      if (!imageInfo || !imageInfo.url) {
        throw new Error("ไม่สามารถดึงข้อมูลรูปภาพได้ หรือ API มีปัญหา");
      }

      const imageUrl = imageInfo.url;
      
      // --- กำหนดชื่อและที่อยู่ของไฟล์ที่จะบันทึก ---
      const fileName = `generated-image_${Date.now()}.webp`;
      const filePath = path.join(CACHE_DIR, fileName);
      const writer = fs.createWriteStream(filePath);

      // --- เริ่มดาวน์โหลดรูปภาพ ---
      const imageStreamRes = await axios({
        url: imageUrl,
        method: 'GET',
        responseType: 'stream'
      });

      imageStreamRes.data.pipe(writer);

      // --- จัดการเมื่อดาวน์โหลดเสร็จสิ้น ---
      writer.on("finish", () => {
        api.sendMessage({
          body: `✅ ภาพสำหรับ "${prompt}" เสร็จแล้วครับ!`,
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
      console.error("❌ Image Generation API Error:", err.message);
      const errorMessage = err.response ? JSON.stringify(err.response.data) : err.message;
      api.sendMessage(`❌ เกิดข้อผิดพลาดในการสร้างภาพ: ${errorMessage}`, threadID, messageID);
    } finally {
        // ลบข้อความ "กำลังวาดภาพ..."
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};
