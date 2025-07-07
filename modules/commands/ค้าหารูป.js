const axios = require("axios");
const fs = require("fs");
const path = require("path");

// --- สร้างโฟลเดอร์ cache หากยังไม่มี ---
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

module.exports = {
  name: "ค้นหารูป",
  description: "ค้นหารูปภาพจาก Pinterest และส่งมาให้ทั้งหมดเป็นชุด",
  version: "1.5.0", // อัปเดตเวอร์ชัน
  aliases: ["pinterest", "searchimg", "หาภาพ"],
  nashPrefix: false,
  cooldowns: 15,

  async execute(api, event, args, prefix) {
    const { threadID, messageID } = event;

    // --- [MODIFIED] ตรวจสอบและแยกจำนวนรูปภาพออกจากคำค้นหา ---
    let batchSize = 12; // ค่าเริ่มต้น
    let searchQuery = args.join(" ").trim();
    const lastArg = args[args.length - 1];
    const requestedCount = parseInt(lastArg, 10);

    // ตรวจสอบว่าอาร์กิวเมนต์สุดท้ายเป็นตัวเลขหรือไม่ และมีคำค้นหาอย่างน้อย 1 คำ
    if (!isNaN(requestedCount) && args.length > 1) {
      // จำกัดจำนวนรูปภาพต่อชุดระหว่าง 1 ถึง 12 เพื่อความเสถียร
      batchSize = Math.min(Math.max(requestedCount, 1), 12);
      searchQuery = args.slice(0, -1).join(" ").trim();
    }

    // --- ตรวจสอบว่าผู้ใช้ใส่คำค้นหามาหรือไม่ ---
    if (!searchQuery) {
      return api.sendMessage(
        `กรุณาใส่คำที่ต้องการค้นหารูปภาพ\nตัวอย่าง:\n• ${prefix}ค้นหารูป อนิเมะ\n• ${prefix}ค้นหารูป อนิเมะ 5 (ส่ง 5 รูปต่อชุด)`,
        threadID,
        messageID
      );
    }

    const waitingMessage = await api.sendMessage(`กำลังค้นหารูปภาพสำหรับ "${searchQuery}"...`, threadID);

    try {
      // --- เรียก API เพื่อค้นหารูปภาพ ---
      const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const apiUrl = `https://kaiz-apis.gleeze.com/api/pinterest?search=${encodeURIComponent(searchQuery)}&apikey=${apiKey}`;
      
      const response = await axios.get(apiUrl, { timeout: 60000 });
      const responseData = response.data;

      // --- ตรวจสอบว่า API ส่งข้อมูลที่ถูกต้องและมีรูปภาพกลับมาหรือไม่ ---
      if (!responseData || !Array.isArray(responseData.data) || responseData.data.length === 0) {
        throw new Error("ไม่พบรูปภาพสำหรับคำค้นหานี้");
      }

      const imageUrls = responseData.data;
      const totalFound = responseData.count || imageUrls.length;

      // [MODIFIED] ใช้ batchSize ที่ผู้ใช้กำหนด
      const numBatches = Math.ceil(imageUrls.length / batchSize);

      await api.editMessage(`✅ พบรูปภาพทั้งหมด ${totalFound} รูป! กำลังเตรียมส่ง ${numBatches} ชุด (ชุดละ ${batchSize} รูป)...`, waitingMessage.messageID);
      await new Promise(resolve => setTimeout(resolve, 1000));

      for (let i = 0; i < imageUrls.length; i += batchSize) {
        const batch = imageUrls.slice(i, i + batchSize);
        const attachments = [];
        const downloadedFiles = [];
        const batchNum = (i / batchSize) + 1;

        // ดาวน์โหลดรูปภาพในชุดปัจจุบัน
        for (const url of batch) {
          const fileName = `pinterest_${Date.now()}_${path.basename(url)}.jpg`;
          const filePath = path.join(CACHE_DIR, fileName);
          
          try {
              const imageResponse = await axios({ url, method: 'GET', responseType: 'stream' });
              const writer = fs.createWriteStream(filePath);
              imageResponse.data.pipe(writer);
              await new Promise((resolve, reject) => {
                  writer.on('finish', resolve);
                  writer.on('error', reject);
              });
              attachments.push(fs.createReadStream(filePath));
              downloadedFiles.push(filePath);
          } catch (downloadError) {
              console.error(`Failed to download image: ${url}`, downloadError.message);
          }
        }

        // ส่งข้อความพร้อมรูปภาพสำหรับชุดปัจจุบัน
        if (attachments.length > 0) {
          const body = `🖼️ รูปภาพสำหรับ "${searchQuery}" (ชุดที่ ${batchNum}/${numBatches})`;
          await api.sendMessage({
            body: body,
            attachment: attachments
          }, threadID, (err, msgInfo) => {
            // ลบไฟล์ที่ดาวน์โหลดมาทั้งหมดหลังจากส่งสำเร็จ
            downloadedFiles.forEach(file => {
              if (fs.existsSync(file)) fs.unlinkSync(file);
            });
          });
          // รอ 1.5 วินาทีก่อนส่งชุดถัดไปเพื่อป้องกันการโดนบล็อก
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

    } catch (err) {
      console.error("❌ Pinterest API Error:", err.message);
      api.sendMessage(`❌ เกิดข้อผิดพลาด: ${err.message}`, threadID, messageID);
    } finally {
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};
