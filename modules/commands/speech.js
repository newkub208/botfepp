const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "พูด",
  description: "แปลงข้อความเป็นเสียงพูดด้วยเสียงและอารมณ์ต่างๆ",
  nashPrefix: false,
  version: "1.0.1",
  cooldowns: 15,
  aliases: ["speech", "say", "talk", "tts", "อ่าน"],
  async execute(api, event, args, prefix) {
    const { threadID, messageID } = event;

    if (args.length === 0) {
      const example = `【 𝗡𝗔𝗦𝗛 】 แปลงข้อความเป็นเสียง 🗣️
──────────────────
🎤 ตัวเลือกเสียง:
Alloy | Ash | Ballad | Coral | Echo | Fable | Onyx | Nova | Sage | Shimmer | Verse

🎭 ตัวเลือกอารมณ์:
Santa | True Crime Buff | Old-Timey | Robot | Eternal Optimist | Patient Teacher | Calm | NYC Cabbie | Dramatic

📌 ตัวอย่าง:
${prefix}พูด Ash | Calm | สวัสดีครับ ยินดีที่ได้รู้จัก
──────────────────`;
      return api.sendMessage(example, threadID, messageID);
    }

    const input = args.join(" ").split("|").map(i => i.trim());
    if (input.length < 3) {
      return api.sendMessage(`❌ รูปแบบไม่ถูกต้อง\nใช้: ${prefix}พูด <เสียง> | <อารมณ์> | <ข้อความ>`, threadID, messageID);
    }

    const [voice, vibe, ...textArr] = input;
    const text = textArr.join(" ");

    api.sendMessage("กรุณารอสักครู่...", threadID, async (err, info) => {
      try {
        const url = `https://zen-api.gleeze.com/api/openai-speech?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}&vibe=${encodeURIComponent(vibe)}`;
        const res = await axios.get(url);
        const audioUrl = res.data.audio;

        if (!res.data.status || !audioUrl) throw new Error("Failed to generate speech.");

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        const filePath = path.join(tempDir, `speech_${Date.now()}.mp3`);
        const writer = fs.createWriteStream(filePath);

        const audioRes = await axios({
          method: "GET",
          url: audioUrl,
          responseType: "stream",
        });

        audioRes.data.pipe(writer);
        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        api.editMessage("📤 Sending audio...", info.messageID);
        const stream = fs.createReadStream(filePath);

        api.sendMessage({ attachment: stream }, threadID, () => {
          fs.unlinkSync(filePath);
          api.unsendMessage(info.messageID);
        });

      } catch (error) {
        console.error("Speech Error:", error.message);
        api.editMessage("❌ Error: " + error.message, info.messageID);
      }
    }, messageID);
  }
};