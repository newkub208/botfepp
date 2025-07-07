const axios = require("axios");
const express = require("express");
const fs = require("fs");
const path = require("path");

// --- การตั้งค่าโฟลเดอร์และไฟล์ ---
const PAGE_DIR = path.join(__dirname, "..", "..", "pages");
if (!fs.existsSync(PAGE_DIR)) {
  fs.mkdirSync(PAGE_DIR, { recursive: true });
}

const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const STATE_FILE = path.join(__dirname, "..", "..", "state.json");
let state = {};
try {
  state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
} catch {
  state = {};
}

// --- การตั้งค่าเว็บเซิร์ฟเวอร์ ---
if (!global.__webServerStarted) {
  const app = express();
  app.use("/pages", express.static(PAGE_DIR));
  const PORT = 5000;
  const HOST = "http://menu.panelaimbot.com";
  
  app.listen(PORT, () => console.log(`🌐 HTML server is running at: ${HOST}:${PORT}/pages`));
  global.__webServerStarted = true;
}

// --- ฟังก์ชันจัดการหน้าเว็บ ---
const slugify = t =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 50);

const randomWords = [
  'aurora', 'breeze', 'comet', 'dream', 'echo', 'forest', 'galaxy',
  'harmony', 'island', 'journey', 'karma', 'lagoon', 'meadow', 'nebula',
  'ocean', 'peak', 'quest', 'river', 'serene', 'tundra', 'umbra',
  'vortex', 'willow', 'xenon', 'yonder', 'zephyr', 'pixel', 'lotus',
  'ember', 'frost', 'glen', 'haven', 'ivory', 'jade'
];

function generateRandomFilename() {
  const word = randomWords[Math.floor(Math.random() * randomWords.length)];
  const shortName = word.substring(0, 5);
  return shortName + '.html';
}


const timeouts = {};
Object.entries(state).forEach(([stateKey, rec]) => scheduleExpiry(stateKey, rec));

function scheduleExpiry(stateKey, rec) {
  if (!rec || !rec.expiresAt) return;
  const msLeft = rec.expiresAt - Date.now();
  if (msLeft <= 0) {
    return deletePage(stateKey);
  }
  timeouts[stateKey] = setTimeout(() => deletePage(stateKey), msLeft);
}

function deletePage(stateKey) {
  const rec = state[stateKey];
  if (!rec || typeof rec.filename !== 'string') {
    if (state[stateKey]) {
        delete state[stateKey];
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    }
    return;
  }

  const fp = path.join(PAGE_DIR, rec.filename);
  try {
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      console.log(`🗑️ Deleted page: ${rec.filename}`);
    }
    delete state[stateKey];
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    clearTimeout(timeouts[stateKey]);
  } catch (err) {
    console.error(`Failed to delete page ${rec.filename}:`, err);
  }
}

// --- โครงสร้างคำสั่งหลัก ---
module.exports = {
  name: "สร้างเว็บ",
  description: "สร้างเว็บเพจจากไอเดียหรือรูปภาพ โดย AI จะสร้างตามไอเดียแบบตรงไปตรงมา",
  version: "7.6.0", // อัปเดตเวอร์ชัน
  aliases: ["createweb", "webai", "htmlai", "สร้างหน้าเว็บ"],
  nashPrefix: false,
  cooldowns: 30,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, senderID, type, messageReply } = event;
    
    let inputArgs = [...args];
    let prompt = "";
    let minutes = 5; // ค่าเริ่มต้น
    let imageUrl = null;
    let statePrompt = "";

    // ตรวจสอบการ Reply รูปภาพ
    if (type === "message_reply" && messageReply.attachments && messageReply.attachments.some(att => att.type === "photo")) {
        const photoAttachment = messageReply.attachments.find(att => att.type === "photo");
        imageUrl = photoAttachment.url;
        prompt = inputArgs.join(" ").trim();
        statePrompt = prompt || `image-${photoAttachment.ID}`;
        console.log(`[INFO] Image URL from reply: ${imageUrl}`);
    } else {
        // ตรวจสอบ URL ในข้อความ
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const urlArg = inputArgs.find(arg => urlRegex.test(arg) && (arg.includes('.jpg') || arg.includes('.png') || arg.includes('.jpeg')));
        if (urlArg) {
            imageUrl = urlArg;
            inputArgs = inputArgs.filter(arg => arg !== urlArg);
            console.log(`[INFO] Image URL from argument: ${imageUrl}`);
        }

        // ตรวจสอบนาที
        if (inputArgs.length > 0) {
            const lastArg = inputArgs[inputArgs.length - 1];
            const potentialMinutes = parseInt(lastArg, 10);
            if (!isNaN(potentialMinutes) && potentialMinutes >= 1 && potentialMinutes <= 60) {
                minutes = potentialMinutes;
                inputArgs.pop(); // เอานาทีออกจาก arguments
            }
        }
        prompt = inputArgs.join(" ").trim();
        statePrompt = prompt || imageUrl;
    }

    if (!prompt && !imageUrl) {
      return api.sendMessage(
        `📝 โปรดระบุไอเดียสำหรับสร้างเว็บ หรือ Reply รูปภาพ\n\nตัวอย่าง:\n- ${prefix}สร้างเว็บ เว็บไซต์ขายดอกไม้ 15\n- (Reply รูป) ${prefix}สร้างเว็บ แนะนำตัวละครในภาพ\n\n(เวลาที่กำหนดได้ 1-60 นาที)`,
        threadID,
        messageID
      );
    }

    const stateKey = slugify(statePrompt);
    const existingState = state[stateKey];

    if (existingState && existingState.filename) {
      await api.sendMessage(
        `✏️ พบหน้าเว็บเดิมจากไอเดีย/รูปภาพนี้ (จะถูกลบใน ${Math.ceil((existingState.expiresAt - Date.now()) / 60000)} นาที)\nกำลังสร้างทับ...`,
        threadID,
        messageID
      );
      return buildPage(api, event, prompt, minutes, true, stateKey, existingState.filename, imageUrl);
    }
    
    let newFilename = generateRandomFilename();
    while (Object.values(state).some(rec => rec && rec.filename === newFilename)) {
        newFilename = generateRandomFilename();
    }
    return buildPage(api, event, prompt, minutes, false, stateKey, newFilename, imageUrl);
  },
};

// --- ฟังก์ชันสร้างหน้าเว็บ (ปรับปรุง Prompt และการตรวจสอบ) ---
async function buildPage(api, event, userPrompt, minutes, isUpdate, stateKey, filename, imageUrl = null) {
  const startTime = Date.now();
  const { senderID, threadID, messageID } = event;
  const fp = path.join(PAGE_DIR, filename);
  const HOST = "http://menu.panelaimbot.com:5000";

  let waitingMessage = await api.sendMessage("🤖 กำลังส่งไอเดียของคุณไปยัง AI...", threadID);

  try {
    // --- STEP 1: เรียกใช้ AI ---
    await api.editMessage("🚀 AI กำลังสร้างสรรค์ผลงานเว็บจากไอเดียของคุณ...", waitingMessage.messageID);
    
    let newApiUrl;
    let apiPrompt;
    const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";

    // **[FIX]** ปรับปรุง Prompt ให้ AI ตอบกลับเฉพาะโค้ดเท่านั้น
    const promptSuffix = `การตอบกลับของคุณต้องเป็นโค้ด HTML ดิบเท่านั้น โดยขึ้นต้นด้วย <!DOCTYPE html> ห้ามใส่ markdown, คำอธิบาย, หรือข้อความอื่นใดๆ. เอาเฉพาะโค้ดเท่านั้น.`;

    if (imageUrl) {
        console.log(`[INFO] Using vision API for web generation. Image: ${imageUrl}`);
        apiPrompt = `จากภาพนี้และไอเดีย "${userPrompt || 'ไม่มี'}", จงสร้างโค้ด HTML แบบไฟล์เดียว (Single-file HTML with inline CSS and JS) ที่เกี่ยวข้องกับภาพ. ${promptSuffix}`;
        newApiUrl = `https://kaiz-apis.gleeze.com/api/gemini-flash-2.0?q=${encodeURIComponent(apiPrompt)}&uid=${senderID}&imageUrl=${encodeURIComponent(imageUrl)}&apikey=${apiKey}`;
    } else {
        console.log("[INFO] Using text API for web generation.");
        apiPrompt = `สร้างโค้ด HTML แบบไฟล์เดียว (Single-file HTML with inline CSS and JS) สำหรับไอเดียนี้: "${userPrompt}". ${promptSuffix}`;
        newApiUrl = `https://kaiz-apis.gleeze.com/api/gemini-pro?ask=${encodeURIComponent(apiPrompt)}&uid=${senderID}&apikey=${apiKey}`;
    }
    
    const apiResponse = await axios.get(newApiUrl, {
      timeout: 180000,
      headers: { 'Accept-Encoding': 'gzip, deflate' }
    });
    console.log('[DEBUG] API Response:', JSON.stringify(apiResponse.data, null, 2));

    const answer = apiResponse.data.response;
    if (!answer || typeof answer !== 'string') {
      throw new Error("AI ไม่ได้ให้คำตอบกลับมา หรือรูปแบบข้อมูลไม่ถูกต้อง");
    }
    
    // --- STEP 2: ดึงโค้ด HTML ---
    let html = null;
    const codeMatch = answer.match(/```(?:html)?\s*([\s\S]+?)```/);

    if (codeMatch && codeMatch[1]) {
      html = codeMatch[1].trim();
    } else {
      html = answer.trim();
    }

    // **[FIX]** ปรับปรุงการตรวจสอบ HTML ให้รัดกุมขึ้น
    if (!html || typeof html !== 'string' || !/^<!DOCTYPE html|<html[\s>]/i.test(html)) {
      console.error("Invalid HTML content received:", html);
      throw new Error("เนื้อหาที่ได้รับไม่ใช่รูปแบบ HTML ที่สมบูรณ์ หรือ AI ไม่ได้ส่งโค้ดกลับมา");
    }

    // --- STEP 3: บันทึกไฟล์และจัดการสถานะ ---
    fs.writeFileSync(fp, html);

    if (timeouts[stateKey]) clearTimeout(timeouts[stateKey]);
    const expiresAt = Date.now() + minutes * 60 * 1000;
    state[stateKey] = { filename, minutes, expiresAt };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    scheduleExpiry(stateKey, state[stateKey]);

    const durationInSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    const pageUrl = `${HOST}/pages/${filename}`;

    const sendFallbackMessage = (reason) => {
      console.error(`[Screenshot Fallback] Reason: ${reason}`);
      const fallbackBody = `✅ ${isUpdate ? "อัปเดต" : "สร้าง"}หน้าเว็บสำเร็จ! (แต่สร้างภาพตัวอย่างไม่ได้)\n` +
                           `🔗 ลิงก์:\n${pageUrl}\n` +
                           `⏱️ เวลาที่ใช้: ${durationInSeconds} วินาที\n` +
                           `🗑️ จะถูกลบใน: ${minutes} นาที`;
      api.sendMessage(fallbackBody, threadID, messageID);
    };

    // --- STEP 4: สร้างภาพตัวอย่าง ---
    try {
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const screenshotPageUrl = `${pageUrl}?v=${Date.now()}`;
      const encodedUrl = encodeURIComponent(screenshotPageUrl);
      const screenshotApiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const screenshotApiUrl = `https://kaiz-apis.gleeze.com/api/screenshot?url=${encodedUrl}&apikey=${screenshotApiKey}`;
      
      const screenshotFileName = `screenshot_${Date.now()}.png`;
      const screenshotFilePath = path.join(CACHE_DIR, screenshotFileName);
      const writer = fs.createWriteStream(screenshotFilePath);

      const imageRes = await axios({
        url: screenshotApiUrl,
        method: 'GET',
        responseType: 'stream',
        timeout: 60000,
      });

      imageRes.data.pipe(writer);

      writer.on("finish", () => {
        const body = `✅ ${isUpdate ? "อัปเดต" : "สร้าง"}หน้าเว็บสำเร็จ!\n` +
                     `🔗 ลิงก์:\n${pageUrl}\n` +
                     `⏱️ เวลาที่ใช้: ${durationInSeconds} วินาที\n` +
                     `🗑️ จะถูกลบใน: ${minutes} นาที`;
        
        api.sendMessage(body, threadID, (err, info) => {
            if (err) return console.error(err);
            api.sendMessage({
                attachment: fs.createReadStream(screenshotFilePath)
            }, threadID, () => {
                if (fs.existsSync(screenshotFilePath)) {
                    fs.unlinkSync(screenshotFilePath);
                }
            });
        }, messageID);
      });

      writer.on("error", (err) => {
        if (fs.existsSync(screenshotFilePath)) fs.unlinkSync(screenshotFilePath);
        sendFallbackMessage(`Error writing image file: ${err.message}`);
      });

    } catch (screenshotError) {
      sendFallbackMessage(`API call for screenshot failed: ${screenshotError.message}`);
    }

  } catch (e) {
    console.error(e);
    let errorMessage = `❌ เกิดข้อผิดพลาดในการสร้างหน้าเว็บ\nสาเหตุ: ${e.message}`;
    if (e.response) {
      errorMessage += ` (Status: ${e.response.status})`;
      if (e.response.data && e.response.data.error) {
        errorMessage += `\nข้อความจาก API: ${e.response.data.error}`;
      }
    }
    await api.sendMessage(errorMessage, threadID, messageID);
  } finally {
    if (waitingMessage && waitingMessage.messageID) {
        api.unsendMessage(waitingMessage.messageID);
    }
  }
}
