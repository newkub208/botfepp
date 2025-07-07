const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "ytmp4",
  description: "ค้นหาและส่งไฟล์วิดีโอ (MP4) จาก YouTube",
  version: "1.0.2", // อัปเดตเวอร์ชัน
  aliases: ["youtubemp4", "วิดีโอ"],
  nashPrefix: false,
  cooldowns: 30,

  async execute(api, event, args, prefix) {
    const { threadID, messageID } = event;

    const cacheDir = path.join(__dirname, "..", "cache");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const searchQuery = args.join(" ").trim();

    if (!searchQuery) {
      return api.sendMessage(
        `กรุณาระบุชื่อวิดีโอสำหรับค้นหา\nตัวอย่าง: ${prefix}ytmp4 เดินมาส่งทาง`,
        threadID,
        messageID
      );
    }

    let waitingMessage = await api.sendMessage(`🔍 กำลังค้นหาวิดีโอ "${searchQuery}"...`, threadID);
    
    try {
      // --- Step 1: ค้นหาวิดีโอจาก API เพื่อเอา URL ---
      const searchApiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const searchApiUrl = `https://kaiz-apis.gleeze.com/api/ytsearch?q=${encodeURIComponent(searchQuery)}&apikey=${searchApiKey}`;

      const searchResponse = await axios.get(searchApiUrl, { timeout: 60000 });
      const searchData = searchResponse.data;
      
      console.log('[DEBUG] YouTube Search API Response:', JSON.stringify(searchData, null, 2));

      if (typeof searchData !== 'object' || searchData === null || !Array.isArray(searchData.items) || searchData.items.length === 0) {
        const apiError = searchData.error || searchData.message || "ไม่พบผลการค้นหา หรือรูปแบบข้อมูลไม่ถูกต้อง";
        throw new Error(apiError);
      }
      
      const videoInfo = searchData.items[0];
      
      if (!videoInfo || !videoInfo.url) {
          throw new Error("ไม่พบวิดีโอที่สามารถประมวลผลได้ในผลการค้นหา");
      }

      const { url: videoUrl } = videoInfo;

      await api.editMessage(`พบวิดีโอแล้ว!\nกำลังเตรียมลิงก์ดาวน์โหลด MP4...`, waitingMessage.messageID);

      // --- Step 2: เรียก API แปลงเป็น MP4 ---
      const mp4ApiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const mp4ApiUrl = `https://kaiz-apis.gleeze.com/api/ytmp4?url=${encodeURIComponent(videoUrl)}&quality=720&apikey=${mp4ApiKey}`;
      
      const mp4Response = await axios.get(mp4ApiUrl, { timeout: 60000 });
      const mp4Data = mp4Response.data;
      
      console.log('[DEBUG] YTMP4 API Response:', JSON.stringify(mp4Data, null, 2));

      if (!mp4Data || !mp4Data.download_url) {
        const apiMp4Error = mp4Data.error || mp4Data.message || "ไม่สามารถดึงลิงก์ดาวน์โหลด MP4 ได้";
        throw new Error(apiMp4Error);
      }

      const { title, download_url: finalDownloadUrl, คุณภาพ: quality } = mp4Data;
      
      await api.editMessage(`กำลังดาวน์โหลดวิดีโอ: "${title}" (คุณภาพ ${quality || 'N/A'})...`, waitingMessage.messageID);

      // --- Step 3: ดาวน์โหลดไฟล์ MP4 ---
      const videoFileName = `ytmp4_${Date.now()}.mp4`;
      const videoFilePath = path.join(cacheDir, videoFileName);
      
      const videoStreamResponse = await axios({
        url: finalDownloadUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 600000,
      });

      const writer = fs.createWriteStream(videoFilePath);
      videoStreamResponse.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          api.sendMessage({
            body: `✅ วิดีโอ: ${title}`,
            attachment: fs.createReadStream(videoFilePath)
          }, threadID, (err) => {
            if (fs.existsSync(videoFilePath)) {
              fs.unlinkSync(videoFilePath);
            }
            if (err) {
              reject(err);
            } else {
              api.unsendMessage(waitingMessage.messageID).catch(() => {});
              resolve();
            }
          }, messageID);
        });

        writer.on("error", (err) => {
          if (fs.existsSync(videoFilePath)) {
            fs.unlinkSync(videoFilePath);
          }
          reject(err);
        });
      });

    } catch (error) {
      console.error("[YTMP4 Command Error]", error);
      let errorMessage = `❌ เกิดข้อผิดพลาด\nสาเหตุ: ${error.message}`;
      
      // --- [FIX] เพิ่มการจัดการข้อผิดพลาด 500 Internal Server Error ---
      if (error.response) {
          console.error("API Response Data:", error.response.data);
          if (error.response.status === 500) {
              errorMessage = "❌ เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ของบริการดาวน์โหลด (500)\nปัญหานี้อาจเป็นปัญหาชั่วคราว โปรดลองใหม่อีกครั้งในภายหลัง หรือลองกับวิดีโออื่นครับ";
          } else {
              errorMessage += `\n(เซิร์ฟเวอร์ตอบกลับ: ${error.response.statusText || error.message})`;
          }
      }
      
      await api.editMessage(errorMessage, waitingMessage.messageID);
    }
  },
};
