const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "ytmp3",
  description: "ค้นหาและส่งไฟล์เสียง (MP3) จาก YouTube",
  version: "1.0.0",
  aliases: ["youtubemp3", "เพลง"],
  nashPrefix: false,
  cooldowns: 30,

  async execute(api, event, args, prefix) {
    const { threadID, messageID } = event;

    // --- ตรวจสอบและสร้างโฟลเดอร์ cache ---
    const cacheDir = path.join(__dirname, "..", "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const searchQuery = args.join(" ").trim();

    if (!searchQuery) {
      return api.sendMessage(
        `กรุณาระบุชื่อเพลงสำหรับค้นหา\nตัวอย่าง: ${prefix}ytmp3 เวลา cocktail`,
        threadID,
        messageID
      );
    }

    let waitingMessage = await api.sendMessage(`🔍 กำลังค้นหาเพลง "${searchQuery}"...`, threadID);
    
    try {
      // --- Step 1: ค้นหาวิดีโอจาก API เพื่อเอา URL ---
      const searchApiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265"; // ใช้ Key เดียวกันได้
      const searchApiUrl = `https://kaiz-apis.gleeze.com/api/ytsearch?q=${encodeURIComponent(searchQuery)}&apikey=${searchApiKey}`;

      const searchResponse = await axios.get(searchApiUrl, { timeout: 60000 });
      const searchData = searchResponse.data;
      
      if (typeof searchData !== 'object' || searchData === null || !Array.isArray(searchData.items) || searchData.items.length === 0) {
        const apiError = searchData.error || searchData.message || "ไม่พบผลการค้นหา หรือรูปแบบข้อมูลไม่ถูกต้อง";
        throw new Error(apiError);
      }
      
      const videoInfo = searchData.items[0];
      
      if (!videoInfo || !videoInfo.url) {
          throw new Error("ไม่พบวิดีโอที่สามารถประมวลผลได้ในผลการค้นหา");
      }

      const { url: videoUrl, title: videoTitle } = videoInfo;

      await api.editMessage(`พบเพลง "${videoTitle}" แล้ว!\nกำลังเตรียมลิงก์ดาวน์โหลด MP3...`, waitingMessage.messageID);

      // --- Step 2: เรียก API แปลงเป็น MP3 ---
      const mp3ApiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const mp3ApiUrl = `https://kaiz-apis.gleeze.com/api/ytdown-mp3?url=${encodeURIComponent(videoUrl)}&apikey=${mp3ApiKey}`;
      
      const mp3Response = await axios.get(mp3ApiUrl, { timeout: 60000 });
      const mp3Data = mp3Response.data;
      
      if (!mp3Data || !mp3Data.download_url) {
        const apiMp3Error = mp3Data.error || mp3Data.message || "ไม่สามารถดึงลิงก์ดาวน์โหลด MP3 ได้";
        throw new Error(apiMp3Error);
      }

      const { title, download_url: finalDownloadUrl } = mp3Data;
      
      await api.editMessage(`กำลังดาวน์โหลดเพลง: "${title}"...`, waitingMessage.messageID);

      // --- Step 3: ดาวน์โหลดไฟล์ MP3 ---
      const audioFileName = `ytmp3_${Date.now()}.mp3`;
      const audioFilePath = path.join(cacheDir, audioFileName);
      
      const audioStreamResponse = await axios({
        url: finalDownloadUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 600000, // เพิ่ม timeout เป็น 10 นาที (600,000 ms)
      });

      const writer = fs.createWriteStream(audioFilePath);
      audioStreamResponse.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          api.sendMessage({
            body: `✅ เพลง: ${title}`,
            attachment: fs.createReadStream(audioFilePath)
          }, threadID, (err) => {
            // ลบไฟล์ใน cache หลังจากส่งเสร็จ
            if (fs.existsSync(audioFilePath)) {
              fs.unlinkSync(audioFilePath);
            }
            if (err) {
              console.error("[YTMP3 Send Error]", err);
              reject(err);
            } else {
              // ลบข้อความ "กำลังดาวน์โหลด..."
              api.unsendMessage(waitingMessage.messageID).catch(() => {});
              resolve();
            }
          }, messageID);
        });

        writer.on("error", (err) => {
          if (fs.existsSync(audioFilePath)) {
            fs.unlinkSync(audioFilePath);
          }
          console.error("[YTMP3 Download Error]", err);
          reject(err);
        });
      });

    } catch (error) {
      console.error("[YTMP3 Command Error]", error);
      let errorMessage = `❌ เกิดข้อผิดพลาด\nสาเหตุ: ${error.message}`;
      if (error.response) {
          console.error("API Response Data:", error.response.data);
          errorMessage += `\n(เซิร์ฟเวอร์ตอบกลับ: ${error.response.statusText || error.message})`;
      }
      // แก้ไขข้อความรอเพื่อแสดงข้อผิดพลาด
      await api.editMessage(errorMessage, waitingMessage.messageID);
    }
  },
};

