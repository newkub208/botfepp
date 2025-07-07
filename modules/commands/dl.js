const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

module.exports = {
    name: "fbdl",
    description: "Download and send high quality Facebook videos",
    nashPrefix: false,
    version: "1.0.0",
    cooldowns: 15,
    aliases: ["facebook", "fbvideo"],
    execute(api, event, args, prefix) {
        const { threadID, messageID } = event;
        
        if (!args[0] || !args[0].includes("facebook.com")) {
            return api.sendMessage("Please provide a valid Facebook video URL.", threadID, messageID);
        }

        const fbUrl = args[0];
        
        api.sendMessage("⏳ Downloading Facebook video, please wait...", threadID, async (err, info) => {
            if (err) return console.error(err);

            try {
                const form = new FormData();
                form.append("k_exp", "1749611486");
                form.append("k_token", "aa26d4a3b2bf844c8af6757179b85c10ab6975dacd30b55ef79d0d695f7ea764");
                form.append("q", fbUrl);
                form.append("lang", "en");
                form.append("web", "fdownloader.net");
                form.append("v", "v2");
                
                const headers = {
                    ...form.getHeaders(),
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Accept": "*/*"
                };

                const response = await axios.post("https://v3.fdownloader.net/api/ajaxSearch", form, { headers });
                
                if (response.data.status !== "ok") {
                    throw new Error("Failed to fetch video data");
                }

                const html = response.data.data;
                const downloadLinks = [];
                
                const mp4Regex = /<a href="(https:\/\/dl\.snapcdn\.app\/download\?token=[^"]+)"[^>]*>Download<\/a>/g;
                let match;
                while ((match = mp4Regex.exec(html)) !== null) {
                    const qualityMatch = html.substring(0, match.index).match(/video-quality[^>]*>([^<]+)</);
                    if (qualityMatch) {
                        downloadLinks.push({
                            url: match[1],
                            quality: qualityMatch[1].trim()
                        });
                    }
                }

                if (downloadLinks.length === 0) {
                    throw new Error("No download links found");
                }

                downloadLinks.sort((a, b) => {
                    const getQualityNum = (q) => parseInt(q.replace(/\D/g, "")) || 0;
                    return getQualityNum(b.quality) - getQualityNum(a.quality);
                });

                const bestQuality = downloadLinks[0];
                
                api.editMessage("⬇️ Downloading video...", info.messageID);
                
                const tempDir = path.join(__dirname, 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir);
                }
                
                const videoPath = path.join(tempDir, `fb_video_${Date.now()}.mp4`);
                const writer = fs.createWriteStream(videoPath);
                
                const videoResponse = await axios({
                    method: 'get',
                    url: bestQuality.url,
                    responseType: 'stream'
                });
                
                videoResponse.data.pipe(writer);
                
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                api.editMessage("📤 Sending video...", info.messageID);
                
                const videoStream = fs.createReadStream(videoPath);
                api.sendMessage({
                    attachment: videoStream
                }, threadID, async () => {
                    fs.unlinkSync(videoPath);
                    api.unsendMessage(info.messageID);
                });

            } catch (error) {
                console.error("Facebook download error:", error);
                api.editMessage("❌ Error: " + error.message, info.messageID);
            }
        }, messageID);
    },
};