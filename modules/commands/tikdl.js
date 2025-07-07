const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "tiktok",
  description: "Download TikTok video (no watermark) using a prompt",
  nashPrefix: false,
  version: "1.0.0",
  cooldowns: 10,
  aliases: ["ttdl", "tt", "tiktoknowm"],
  async execute(api, event, args, prefix) {
    const { threadID, messageID } = event;

    const query = args.join(" ");
    if (!query) {
      return api.sendMessage("Please enter a prompt", threadID, messageID);
    }

    api.sendMessage("🔍 Searching, please wait...", threadID, async (err, info) => {
      try {
        const res = await axios.get(`https://zen-api.gleeze.com/api/tiktok?query=${encodeURIComponent(query)}`);
        const data = res.data;

        if (!data || !data.no_watermark) {
          throw new Error("No video found.");
        }

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const fileName = `tiktok_${Date.now()}.mp4`;
        const videoPath = path.join(tempDir, fileName);
        const writer = fs.createWriteStream(videoPath);

        const videoStream = await axios({
          method: "GET",
          url: data.no_watermark,
          responseType: "stream",
        });

        videoStream.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        api.editMessage("📤 Sending video...", info.messageID);

        const attachment = fs.createReadStream(videoPath);
        api.sendMessage({
          body: `🎬 Title: ${data.title}`,
          attachment,
        }, threadID, () => {
          fs.unlinkSync(videoPath);
          api.unsendMessage(info.messageID);
        });

      } catch (e) {
        console.error("TikTok Download Error:", e.message);
        api.editMessage(`❌ Error: ${e.message}`, info.messageID);
      }
    }, messageID);
  }
};
