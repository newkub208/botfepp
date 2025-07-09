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
    name: "autoMediaDL",
    version: "1.0.0",
    description: "Auto download TikTok, Facebook, and Instagram videos when enabled",
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
            if (!autoDLState.enabled) return;
            
            // ถ้า AutoDL เปิดอยู่แต่ไม่มี thread ID นี้ในรายการ ให้เพิ่มเข้าไป
            if (!autoDLState.threads[event.threadID]) {
                autoDLState.threads[event.threadID] = true;
                fs.writeFileSync(autoDLStateFile, JSON.stringify(autoDLState, null, 2));
            }

            // ตรวจหาลิงก์ TikTok, Facebook และ Instagram ในข้อความ
            const tiktokRegex = /(?:https?:\/\/)?(?:www\.)?(?:vm\.|vt\.)?tiktok\.com\/\S+/gi;
            const facebookRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?facebook\.com\/(?:share\/[rv]\/\S+|watch\/\?\S*|reel\/\S+|\S+\/videos\/\S+|\S+)|(?:https?:\/\/)?fb\.watch\/\S+/gi;
            const instagramRegex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/\S+/gi;
            
            const tiktokLinks = event.body.match(tiktokRegex);
            const facebookLinks = event.body.match(facebookRegex);
            const instagramLinks = event.body.match(instagramRegex);
            const mediaLinks = [...(tiktokLinks || []), ...(facebookLinks || []), ...(instagramLinks || [])];

            if (!mediaLinks || mediaLinks.length === 0) return;

            // ดาวน์โหลดวิดีโอจากลิงก์แรกที่พบ
            const videoUrl = mediaLinks[0];
            console.log("🎯 Found video link:", videoUrl);
            
            const waitingMessage = await api.sendMessage("📥 พบลิงก์วิดีโอ! กำลังดาวน์โหลดอัตโนมัติ...", event.threadID);

            // เรียก API เพื่อดึงข้อมูลวิดีโอ
            const apiKey = "024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef";
            const apiUrl = `https://haji-mix-api.gleeze.com/api/autodl?url=${encodeURIComponent(videoUrl)}&stream=true&api_key=${apiKey}`;
            
            // First, try to get JSON info (without stream=true)
            let videoInfo;
            let videoDownloadUrl;
            let videoTitle = "Video from social media";
            
            try {
                const infoUrl = `https://haji-mix-api.gleeze.com/api/autodl?url=${encodeURIComponent(videoUrl)}&api_key=${apiKey}`;
                const infoRes = await axios.get(infoUrl, { timeout: 30000 });
                
                if (infoRes.data && !infoRes.data.error && typeof infoRes.data === 'object') {
                    videoInfo = infoRes.data;
                    videoTitle = videoInfo.title || videoInfo.data?.title || "Video from social media";
                    
                    // ค้นหา download URL จาก JSON response
                    if (videoInfo.download_url) {
                        videoDownloadUrl = videoInfo.download_url;
                    } else if (videoInfo.url) {
                        videoDownloadUrl = videoInfo.url;
                    } else if (videoInfo.data && videoInfo.data.download_url) {
                        videoDownloadUrl = videoInfo.data.download_url;
                    } else if (videoInfo.data && videoInfo.data.url) {
                        videoDownloadUrl = videoInfo.data.url;
                    }
                }
            } catch (error) {
                // Silently fail and use direct download
            }
            
            // If no download URL from JSON, use direct stream URL
            if (!videoDownloadUrl) {
                videoDownloadUrl = apiUrl;
            }
            
            // กำหนดชื่อและที่อยู่ของไฟล์ที่จะบันทึก
            const fileName = `auto_video_${Date.now()}.mp4`;
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
            console.error("❌ Auto Video DL Error:", error.message);
            api.sendMessage(`❌ เกิดข้อผิดพลาดในการดาวน์โหลดอัตโนมัติ: ${error.message}`, event.threadID);
        }
    }
};
