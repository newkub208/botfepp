const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "ภาพเว็บ",
  description: "ถ่ายภาพหน้าจอเว็บไซต์จากลิงก์ที่ให้มา",
  version: "1.0.0",
  cooldowns: 5,
  nashPrefix: true,
  aliases: ["screenshot", "เว็บ", "เว็บแคป"],

  async execute(api, event, args) {
    const { threadID, messageID } = event;
    const inputUrl = args.join(" ");

    if (!inputUrl) {
      return api.sendMessage("🌐 กรุณาใส่ลิงก์เว็บไซต์ เช่น:\nภาพเว็บ https://example.com", threadID, messageID);
    }

    try {
      const encodedUrl = encodeURIComponent(inputUrl);
      const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const apiUrl = `https://kaiz-apis.gleeze.com/api/screenshot?url=${encodedUrl}&apikey=${apiKey}`;

      // สร้างโฟลเดอร์ cache หากยังไม่มี
      const cachePath = path.join(__dirname, "cache");
      if (!fs.existsSync(cachePath)) {
        fs.mkdirSync(cachePath);
      }

      const fileName = `screenshot_${Date.now()}.png`;
      const filePath = path.join(cachePath, fileName);
      const writer = fs.createWriteStream(filePath);

      const imageRes = await axios({
        url: apiUrl,
        method: 'GET',
        responseType: 'stream'
      });

      imageRes.data.pipe(writer);

      writer.on("finish", () => {
        api.sendMessage({
          body: `📸 ถ่ายภาพจากเว็บ: ${inputUrl}`,
          attachment: fs.createReadStream(filePath)
        }, threadID, () => fs.unlinkSync(filePath)); // ลบรูปหลังส่ง
      });

      writer.on("error", (err) => {
        console.error("❌ เขียนไฟล์ผิดพลาด:", err);
        api.sendMessage("❌ ไม่สามารถบันทึกไฟล์ภาพได้", threadID, messageID);
      });

    } catch (err) {
      console.error("❌ Screenshot API Error:", err.message);
      return api.sendMessage("❌ เกิดข้อผิดพลาดในการดึงภาพจากเว็บ", threadID, messageID);
    }
  }
};