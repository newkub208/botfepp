const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- สร้างโฟลเดอร์ cache หากยังไม่มี ---
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

module.exports = {
  name: "ดาวโหลด",
  description: "ดาวน์โหลดวิดีโอจาก TikTok โดยใช้ลิงก์",
  version: "1.0.0",
  aliases: ["tt", "tiktokdl"],
  nashPrefix: false,
  cooldowns: 10,

  async execute(api, event, args, prefix) {
    const { threadID, messageID } = event;
    const videoUrl = args[0];

    // --- ตรวจสอบว่าผู้ใช้ใส่ลิงก์มาหรือไม่ ---
    if (!videoUrl || !videoUrl.includes("tiktok.com")) {
      return api.sendMessage(
        `กรุณาใส่ลิงก์วิดีโอ TikTok ที่ถูกต้อง\nตัวอย่าง: ${prefix}tiktok https://vt.tiktok.com/ZSMK3hUeY/`,
        threadID,
        messageID
      );
    }

    const waitingMessage = await api.sendMessage("📥 กำลังดาวน์โหลดวิดีโอ โปรดรอสักครู่...", threadID);

    try {
      // --- เรียก API เพื่อดึงข้อมูลวิดีโอ ---
      const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const apiUrl = `https://kaiz-apis.gleeze.com/api/tiktok-dl?url=${encodeURIComponent(videoUrl)}&apikey=${apiKey}`;
      
      const infoRes = await axios.get(apiUrl, { timeout: 60000 });
      const videoInfo = infoRes.data;

      // --- ตรวจสอบว่า API ส่งข้อมูลที่ถูกต้องกลับมาหรือไม่ ---
      if (!videoInfo || !videoInfo.url) {
        throw new Error("ไม่สามารถดึงข้อมูลวิดีโอได้ กรุณาตรวจสอบลิงก์อีกครั้ง");
      }

      const videoDownloadUrl = videoInfo.url;
      const videoTitle = videoInfo.title || "Video from TikTok";
      
      // --- กำหนดชื่อและที่อยู่ของไฟล์ที่จะบันทึก ---
      const fileName = `tiktok_${Date.now()}.mp4`;
      const filePath = path.join(CACHE_DIR, fileName);
      const writer = fs.createWriteStream(filePath);

      // --- เริ่มดาวน์โหลดวิดีโอ ---
      const videoStreamRes = await axios({
        url: videoDownloadUrl,
        method: 'GET',
        responseType: 'stream'
      });

      videoStreamRes.data.pipe(writer);

      // --- จัดการเมื่อดาวน์โหลดเสร็จสิ้น ---
      writer.on("finish", () => {
        api.sendMessage({
          body: `✅ ดาวน์โหลดสำเร็จ!\n\n📝: ${videoTitle}`,
          attachment: fs.createReadStream(filePath)
        }, threadID, () => {
          // ลบไฟล์วิดีโอออกจาก cache หลังจากส่งสำเร็จ
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, messageID);
      });

      // --- จัดการเมื่อเกิดข้อผิดพลาดระหว่างดาวน์โหลด ---
      writer.on("error", (err) => {
        console.error("❌ Error writing video file:", err);
        api.sendMessage("❌ เกิดข้อผิดพลาดในการบันทึกวิดีโอ", threadID, messageID);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

    } catch (err) {
      console.error("❌ TikTok API Error:", err.message);
      // ส่งข้อความแจ้งเตือนที่เข้าใจง่าย
      const errorMessage = err.response ? JSON.stringify(err.response.data) : err.message;
      api.sendMessage(`❌ เกิดข้อผิดพลาด: ${errorMessage}`, threadID, messageID);
    } finally {
        // ลบข้อความ "กำลังดาวน์โหลด..."
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};
