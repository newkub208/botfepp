const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Path to AutoDL state file
const autoDLStateFile = path.join(__dirname, "autoDLState.json");

// สร้างโฟลเดอร์ cache หากยังไม่มี
const CACHE_DIR = path.join(__dirname, "../commands/cache");
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

module.exports = {
    name: "autoTikTokDL",
    version: "1.0.0",
    description: "Auto download TikTok videos when enabled",
    author: "Kaizenji",
    async onEvent({ api, event }) {
        // Skip if it's a command (starts with /)
        if (event.body && event.body.startsWith("/")) return;
        
        // Skip if it's from bot itself
        if (event.senderID === api.getCurrentUserID()) return;
        
        // Skip if no message body
        if (!event.body) return;

        try {
            // Check if AutoDL is enabled for this thread
            if (!fs.existsSync(autoDLStateFile)) return;
            
            const autoDLState = JSON.parse(fs.readFileSync(autoDLStateFile, "utf8"));
            
            // Check if AutoDL is enabled globally and for this specific thread
            if (!autoDLState.enabled || !autoDLState.threads[event.threadID]) return;

            // ตรวจหาลิงก์ TikTok ในข้อความ
            const tiktokRegex = /(?:https?:\/\/)?(?:www\.)?(?:vm\.|vt\.)?tiktok\.com\/\S+|(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/gi;
            const tiktokLinks = event.body.match(tiktokRegex);

            if (!tiktokLinks || tiktokLinks.length === 0) return;

            // ดาวน์โหลดวิดีโอจากลิงก์แรกที่พบ
            const videoUrl = tiktokLinks[0];
            
            const waitingMessage = await api.sendMessage("📥 พบลิงก์ TikTok! กำลังดาวน์โหลดอัตโนมัติ...", event.threadID);

            // เรียก API เพื่อดึงข้อมูลวิดีโอ
            const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
            const apiUrl = `https://kaiz-apis.gleeze.com/api/tiktok-dl?url=${encodeURIComponent(videoUrl)}&apikey=${apiKey}`;
            
            const infoRes = await axios.get(apiUrl, { timeout: 60000 });
            const videoInfo = infoRes.data;

            // ตรวจสอบว่า API ส่งข้อมูลที่ถูกต้องกลับมาหรือไม่
            if (!videoInfo || !videoInfo.url) {
                throw new Error("ไม่สามารถดึงข้อมูลวิดีโอได้ กรุณาตรวจสอบลิงก์อีกครั้ง");
            }

            const videoDownloadUrl = videoInfo.url;
            const videoTitle = videoInfo.title || "Video from TikTok";
            
            // กำหนดชื่อและที่อยู่ของไฟล์ที่จะบันทึก
            const fileName = `auto_tiktok_${Date.now()}.mp4`;
            const filePath = path.join(CACHE_DIR, fileName);
            const writer = fs.createWriteStream(filePath);

            // เริ่มดาวน์โหลดวิดีโอ
            const videoStreamRes = await axios({
                url: videoDownloadUrl,
                method: 'GET',
                responseType: 'stream'
            });

            videoStreamRes.data.pipe(writer);

            // จัดการเมื่อดาวน์โหลดเสร็จสิ้น
            writer.on("finish", () => {
                api.sendMessage({
                    body: `✅ ดาวน์โหลดอัตโนมัติสำเร็จ!\n\n📝: ${videoTitle}\n🔗: ${videoUrl}`,
                    attachment: fs.createReadStream(filePath)
                }, event.threadID, () => {
                    // ลบไฟล์วิดีโอออกจาก cache หลังจากส่งสำเร็จ
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                });
                
                // ลบข้อความ "กำลังดาวน์โหลด..."
                api.unsendMessage(waitingMessage.messageID);
            });

            // จัดการเมื่อเกิดข้อผิดพลาดระหว่างดาวน์โหลด
            writer.on("error", (err) => {
                console.error("❌ Error writing video file:", err);
                api.sendMessage("❌ เกิดข้อผิดพลาดในการบันทึกวิดีโอ", event.threadID);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                // ลบข้อความ "กำลังดาวน์โหลด..."
                api.unsendMessage(waitingMessage.messageID);
            });

        } catch (error) {
            console.error("Auto TikTok DL Error:", error);
            api.sendMessage(`❌ เกิดข้อผิดพลาดในการดาวน์โหลดอัตโนมัติ: ${error.message}`, event.threadID);
        }
    }
};
