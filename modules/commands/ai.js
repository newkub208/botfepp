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
  description: "สร้างเว็บเพจจากไอเดียหรือรูปภาพ โดย AI 2 ชั้น: Gemini Flash 2.0 (อ่านภาพ) + GPT-4O (สร้างเว็บ) + ดูโค้ด + แก้ไขเฉพาะจุด",
  version: "8.1.0", // อัปเดตเวอร์ชัน - เพิ่มฟีเจอร์แก้ไขและรายละเอียด
  aliases: ["createweb", "webai", "htmlai", "สร้างหน้าเว็บ", "viewcode", "ดูโค้ด", "รายละเอียด", "แก้ไข", "edit", "list"],
  nashPrefix: false,
  cooldowns: 30,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, senderID, type, messageReply } = event;
    
    // ตรวจสอบคำสั่งดูโค้ด
    if (args.length > 0 && (args[0].toLowerCase() === 'viewcode' || args[0] === 'ดูโค้ด')) {
      return await this.handleViewCode(api, event, args.slice(1));
    }

    // ตรวจสอบคำสั่งดูรายละเอียด
    if (args.length > 0 && (args[0].toLowerCase() === 'รายละเอียด' || args[0].toLowerCase() === 'list' || args[0].toLowerCase() === 'ลิสต์')) {
      return await this.handleListDetails(api, event);
    }

    // ตรวจสอบคำสั่งแก้ไข
    if (args.length > 0 && (args[0].toLowerCase() === 'แก้ไข' || args[0].toLowerCase() === 'edit')) {
      return await this.handleEdit(api, event, args.slice(1));
    }
    
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
        `📝 โปรดระบุไอเดียสำหรับสร้างเว็บ หรือ Reply รูปภาพ\n\n` +
        `🤖 ระบบ AI 2 ชั้น:\n` +
        `🔍 Gemini Flash 2.0: อ่านและวิเคราะห์ภาพ\n` +
        `🚀 GPT-4O: สร้างเว็บไซต์\n\n` +
        `📋 คำสั่งต่างๆ:\n` +
        `🔸 สร้างเว็บ: ${prefix}สร้างเว็บ เว็บไซต์ขายดอกไม้ 15\n` +
        `🔸 ดูรายละเอียด: ${prefix}สร้างเว็บ รายละเอียด\n` +
        `🔸 แก้ไขเว็บ: ${prefix}สร้างเว็บ แก้ไข ชื่อไฟล์\n` +
        `🔸 ดูโค้ด: ${prefix}สร้างเว็บ ดูโค้ด all\n\n` +
        `⚡ คุณสมบัติ:\n- วิเคราะห์ภาพด้วย Gemini Flash 2.0\n- สร้างเว็บด้วย GPT-4O\n- แก้ไขเฉพาะจุดได้\n- UI/UX สวยงามแบบมืออาชีพ\n\n` +
        `(เวลาที่กำหนดได้ 1-60 นาที)`,
        threadID,
        messageID
      );
    }

    const stateKey = slugify(statePrompt);
    const existingState = state[stateKey];

    if (existingState && existingState.filename) {
      let existingMessage = `✏️ พบหน้าเว็บเดิมจากไอเดีย/รูปภาพนี้ (จะถูกลบใน ${Math.ceil((existingState.expiresAt - Date.now()) / 60000)} นาที)\n`;
      
      if (existingState.pastebinUrl) {
        existingMessage += `📄 ดูโค้ดเดิม: ${existingState.pastebinUrl}\n`;
      }
      
      existingMessage += `กำลังสร้างทับ...`;
      
      await api.sendMessage(existingMessage, threadID, messageID);
      return buildPage(api, event, prompt, minutes, true, stateKey, existingState.filename, imageUrl);
    }
    
    let newFilename = generateRandomFilename();
    while (Object.values(state).some(rec => rec && rec.filename === newFilename)) {
        newFilename = generateRandomFilename();
    }
    return buildPage(api, event, prompt, minutes, false, stateKey, newFilename, imageUrl);
  },

  // ฟังก์ชันดูโค้ดของเว็บที่สร้างไว้
  async handleViewCode(api, event, args) {
    const { threadID, messageID } = event;
    
    if (args.length === 0) {
      return api.sendMessage(
        `📋 การใช้งานคำสั่งดูโค้ด:\n\n` +
        `🔸 ดูโค้ดทั้งหมด: ดูโค้ด all\n` +
        `🔸 ดูโค้ดจากไอเดีย: ดูโค้ด <ไอเดียที่ใช้สร้าง>\n\n` +
        `ตัวอย่าง:\n- ดูโค้ด all\n- ดูโค้ด เว็บขายดอกไม้`,
        threadID,
        messageID
      );
    }

    const query = args.join(" ").trim().toLowerCase();
    
    if (query === "all" || query === "ทั้งหมด") {
      // แสดงรายการเว็บทั้งหมดที่มีอยู่
      const activePages = Object.entries(state).filter(([key, rec]) => 
        rec && rec.filename && rec.pastebinUrl
      );
      
      if (activePages.length === 0) {
        return api.sendMessage(
          `📄 ไม่พบเว็บเพจที่สร้างไว้ในขณะนี้`,
          threadID,
          messageID
        );
      }
      
      let message = `📋 รายการเว็บที่สร้างไว้ (${activePages.length} เว็บ):\n\n`;
      
      activePages.forEach(([key, rec], index) => {
        const minutesLeft = Math.ceil((rec.expiresAt - Date.now()) / 60000);
        const createdTime = new Date(rec.createdAt || Date.now()).toLocaleString('th-TH');
        message += `${index + 1}. 🌐 ${key.replace(/-/g, ' ')}\n`;
        message += `   📄 โค้ด: ${rec.pastebinUrl}\n`;
        message += `   ⏰ เหลือเวลา: ${minutesLeft} นาที\n`;
        message += `   📅 สร้างเมื่อ: ${createdTime}\n\n`;
      });
      
      return api.sendMessage(message, threadID, messageID);
    } else {
      // ค้นหาเว็บจากไอเดีย
      const searchKey = slugify(query);
      const foundState = state[searchKey];
      
      if (!foundState || !foundState.pastebinUrl) {
        return api.sendMessage(
          `❌ ไม่พบเว็บที่สร้างจากไอเดีย "${query}"\n\n` +
          `💡 ลองใช้: ดูโค้ด all เพื่อดูรายการทั้งหมด`,
          threadID,
          messageID
        );
      }
      
      const minutesLeft = Math.ceil((foundState.expiresAt - Date.now()) / 60000);
      const HOST = "http://menu.panelaimbot.com:5000";
      const pageUrl = `${HOST}/pages/${foundState.filename}`;
      
      return api.sendMessage(
        `📄 พบโค้ดจากไอเดีย: "${query}"\n\n` +
        `🔗 ลิงก์เว็บ: ${pageUrl}\n` +
        `📄 ดูโค้ด: ${foundState.pastebinUrl}\n` +
        `⏰ เหลือเวลา: ${minutesLeft} นาที`,
        threadID,
        messageID
      );
    }
  },

  // ฟังก์ชันดูรายละเอียดไฟล์ทั้งหมดที่สร้าง
  async handleListDetails(api, event) {
    const { threadID, messageID } = event;
    
    const activePages = Object.entries(state).filter(([key, rec]) => 
      rec && rec.filename
    );
    
    if (activePages.length === 0) {
      return api.sendMessage(
        `📄 ไม่พบเว็บเพจที่สร้างไว้ในขณะนี้\n\n` +
        `💡 สร้างเว็บใหม่ด้วย: สร้างเว็บ <ไอเดีย>`,
        threadID,
        messageID
      );
    }
    
    let message = `📋 รายละเอียดเว็บที่สร้างไว้ (${activePages.length} เว็บ):\n\n`;
    
    activePages.forEach(([key, rec], index) => {
      const minutesLeft = Math.ceil((rec.expiresAt - Date.now()) / 60000);
      const createdTime = new Date(rec.createdAt || Date.now()).toLocaleString('th-TH');
      const HOST = "http://menu.panelaimbot.com:5000";
      const pageUrl = `${HOST}/pages/${rec.filename}`;
      
      message += `${index + 1}. 🌐 **${key.replace(/-/g, ' ')}**\n`;
      message += `   📁 ไฟล์: ${rec.filename}\n`;
      message += `   🔗 ลิงก์: ${pageUrl}\n`;
      if (rec.pastebinUrl) {
        message += `   📄 โค้ด: ${rec.pastebinUrl}\n`;
      }
      message += `   ⏰ เหลือเวลา: ${minutesLeft > 0 ? minutesLeft + ' นาที' : 'หมดเวลาแล้ว'}\n`;
      message += `   📅 สร้างเมื่อ: ${createdTime}\n`;
      message += `   ✏️ แก้ไข: สร้างเว็บ แก้ไข ${rec.filename}\n\n`;
    });
    
    message += `💡 วิธีใช้งาน:\n`;
    message += `🔸 แก้ไขเว็บ: สร้างเว็บ แก้ไข <ชื่อไฟล์>\n`;
    message += `🔸 ดูโค้ด: สร้างเว็บ ดูโค้ด <ชื่อไฟล์>`;
    
    return api.sendMessage(message, threadID, messageID);
  },

  // ฟังก์ชันแก้ไขเว็บเฉพาะจุด
  async handleEdit(api, event, args) {
    const { threadID, messageID, senderID } = event;
    
    if (args.length === 0) {
      return api.sendMessage(
        `📝 กรุณาระบุชื่อไฟล์ที่ต้องการแก้ไข\n\n` +
        `ตัวอย่าง: สร้างเว็บ แก้ไข dream.html\n\n` +
        `💡 ดูรายชื่อไฟล์: สร้างเว็บ รายละเอียด`,
        threadID,
        messageID
      );
    }
    
    const filename = args[0];
    
    // หาไฟล์ที่ตรงกับชื่อ
    const foundState = Object.entries(state).find(([key, rec]) => 
      rec && rec.filename === filename
    );
    
    if (!foundState) {
      return api.sendMessage(
        `❌ ไม่พบไฟล์ "${filename}"\n\n` +
        `💡 ดูรายชื่อไฟล์: สร้างเว็บ รายละเอียด`,
        threadID,
        messageID
      );
    }
    
    const [stateKey, rec] = foundState;
    
    // ถามว่าต้องการแก้อะไร
    const editMessage = await api.sendMessage(
      `✏️ พบไฟล์: ${filename}\n\n` +
      `🔧 คุณต้องการแก้ไขอะไร?\n` +
      `📝 กรุณาระบุรายละเอียดการแก้ไข เช่น:\n` +
      `- "เปลี่ยนสีพื้นหลังเป็นสีฟ้า"\n` +
      `- "เพิ่มปุ่มสมัครสมาชิก"\n` +
      `- "แก้ไขฟอนต์ให้ใหญ่ขึ้น"\n` +
      `- "เพิ่มเอฟเฟกต์ animation"\n\n` +
      `⏰ รอการตอบกลับ... (timeout 2 นาที)`,
      threadID,
      messageID
    );
    
    // รอการตอบกลับ
    const filter = (response) => response.senderID === senderID && response.threadID === threadID;
    
    try {
      const collected = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('timeout'));
        }, 120000); // 2 นาที
        
        const messageListener = (response) => {
          if (filter(response)) {
            clearTimeout(timeout);
            api.removeListener('message', messageListener);
            resolve(response);
          }
        };
        
        api.on('message', messageListener);
      });
      
      const editRequest = collected.body;
      
      if (!editRequest || editRequest.trim().length === 0) {
        return api.sendMessage("❌ กรุณาระบุรายละเอียดการแก้ไข", threadID, messageID);
      }
      
      // ดำเนินการแก้ไข
      return await this.performEdit(api, event, stateKey, rec, editRequest);
      
    } catch (error) {
      if (error.message === 'timeout') {
        return api.sendMessage("⏰ หมดเวลารอการตอบกลับ กรุณาลองใหม่", threadID, messageID);
      }
      throw error;
    }
  },

  // ฟังก์ชันดำเนินการแก้ไข
  async performEdit(api, event, stateKey, rec, editRequest) {
    const { threadID, messageID, senderID } = event;
    const fp = path.join(PAGE_DIR, rec.filename);
    const HOST = "http://menu.panelaimbot.com:5000";
    
    let waitingMessage = await api.sendMessage("🔧 กำลังแก้ไขเว็บตามคำขอของคุณ...", threadID);
    
    try {
      // อ่านไฟล์เดิม
      if (!fs.existsSync(fp)) {
        throw new Error("ไฟล์เดิมไม่พบ อาจถูกลบไปแล้ว");
      }
      
      const existingHtml = fs.readFileSync(fp, 'utf8');
      
      await api.editMessage("🤖 GPT-4O กำลังวิเคราะห์และแก้ไขโค้ด...", waitingMessage.messageID);
      
      // เตรียม prompt สำหรับการแก้ไขแบบมืออาชีพ (ย่อให้สั้นลง)
      const shortEditRequest = truncatePrompt(editRequest, 100);
      const shortExistingHtml = truncatePrompt(existingHtml, 3000);
      
      const editPrompt = `แก้ไขโค้ด HTML ตามคำขอ: "${shortEditRequest}"

โค้ดเดิม:
${shortExistingHtml}

สร้างโค้ด HTML ใหม่ที่แก้ไขแล้ว เริ่มต้นด้วย <!DOCTYPE html> มี CSS และ JS inline สวยงาม modern responsive`;

      const apiKey = "024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef";
      const roleplay = "รับบทเป็นผู้สร้างโค้ดhtml ทำสวยๆ";
      
      // ตรวจสอบขนาด URL ก่อนส่ง request
      const testUrl = `https://haji-mix-api.gleeze.com/api/gpt4o?ask=${encodeURIComponent(editPrompt)}&uid=${senderID}&roleplay=${encodeURIComponent(roleplay)}&api_key=${apiKey}`;
      
      let finalPrompt = editPrompt;
      if (!validateUrlLength(testUrl)) {
        // ถ้า URL ยาวเกินไป ให้ใช้ prompt ที่สั้นกว่า
        finalPrompt = `แก้ไข HTML ตาม: "${shortEditRequest}". สร้างใหม่ให้สวยงาม responsive`;
      }
      
      const apiResponse = await axios.get('https://haji-mix-api.gleeze.com/api/gpt4o', {
        params: {
          ask: finalPrompt,
          uid: senderID,
          roleplay: roleplay,
          api_key: apiKey
        },
        timeout: 180000,
        headers: { 
          'Accept-Encoding': 'gzip, deflate'
        }
      }).catch(error => {
        // ถ้าเกิด error 431 (Header Too Large) ให้ลองใช้ prompt ที่สั้นที่สุด
        if (error.response && error.response.status === 431) {
          const minimalPrompt = `แก้ไข HTML ตาม: "${truncatePrompt(editRequest, 30)}"`;
          
          return axios.get('https://haji-mix-api.gleeze.com/api/gpt4o', {
            params: {
              ask: minimalPrompt,
              uid: senderID,
              roleplay: "ช่วยแก้ไขเว็บ",
              api_key: apiKey
            },
            timeout: 180000,
            headers: { 'Accept-Encoding': 'gzip, deflate' }
          });
        }
        throw error;
      });
      
      if (apiResponse.status !== 200 || (apiResponse.data && apiResponse.data.error)) {
        const errorMsg = apiResponse.data.error || `API returned status ${apiResponse.status}`;
        throw new Error(`API Error: ${errorMsg}`);
      }

      const answer = apiResponse.data.answer;
      
      if (!answer || typeof answer !== 'string') {
        throw new Error("GPT-4O ไม่ได้ให้คำตอบกลับมา");
      }
      
      // ดึงโค้ด HTML ที่แก้ไขแล้ว
      let editedHtml = null;
      
      const patterns = [
        /```(?:html)?\s*([\s\S]+?)```/,
        /```\s*(<!DOCTYPE[\s\S]+?)```/,
        /```\s*(<html[\s\S]+?)```/,
      ];
      
      let found = false;
      for (const pattern of patterns) {
        const match = answer.match(pattern);
        if (match && match[1]) {
          editedHtml = match[1].trim();
          found = true;
          break;
        }
      }
      
      if (!found) {
        editedHtml = answer.trim();
      }
      
      if (!editedHtml || typeof editedHtml !== 'string') {
        throw new Error("ไม่สามารถดึงโค้ดที่แก้ไขได้");
      }
      
      // ถ้าไม่ใช่ HTML ที่สมบูรณ์ ให้สร้าง template ห่อหุ้มแบบสวยๆ
      if (!/^<!DOCTYPE html|<html[\s>]/i.test(editedHtml)) {
        editedHtml = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edited Web</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', sans-serif; 
            line-height: 1.6; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <div class="container">
        ${editedHtml}
    </div>
</body>
</html>`;
      }
      
      // บันทึกไฟล์ที่แก้ไขแล้ว
      fs.writeFileSync(fp, editedHtml);
      
      // อัปโหลดโค้ดใหม่ไป Pastebin
      await api.editMessage("📤 กำลังอัปโหลดโค้ดที่แก้ไขแล้ว...", waitingMessage.messageID);
      const pastebinTitle = `Edited Web Code - ${editRequest.substring(0, 30)}`;
      const pastebinUrl = await uploadToPastebin(editedHtml, pastebinTitle);
      
      // อัปเดต state
      state[stateKey].pastebinUrl = pastebinUrl || state[stateKey].pastebinUrl;
      state[stateKey].lastEdited = Date.now();
      state[stateKey].editHistory = state[stateKey].editHistory || [];
      state[stateKey].editHistory.push({
        request: editRequest,
        timestamp: Date.now(),
        pastebinUrl: pastebinUrl
      });
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      
      const pageUrl = `${HOST}/pages/${rec.filename}`;
      
      let successMessage = `✅ แก้ไขเว็บสำเร็จ!\n`;
      successMessage += `📝 การแก้ไข: ${editRequest}\n`;
      successMessage += `🔗 ลิงก์: ${pageUrl}\n`;
      if (pastebinUrl) {
        successMessage += `📄 โค้ดใหม่: ${pastebinUrl}\n`;
      }
      successMessage += `⏰ เหลือเวลา: ${Math.ceil((rec.expiresAt - Date.now()) / 60000)} นาที`;
      
      await api.sendMessage(successMessage, threadID, messageID);
      
    } catch (error) {
      console.error('[EDIT ERROR]', error);
      let errorMessage = `❌ เกิดข้อผิดพลาดในการแก้ไข\nสาเหตุ: ${error.message}`;
      
      if (error.response) {
        errorMessage += ` (Status: ${error.response.status})`;
        if (error.response.status === 431) {
          errorMessage += `\n💡 คำแนะนำ: คำขอแก้ไขยาวเกินไป ลองใช้คำสั่งสั้นๆ กว่านี้`;
        }
      }
      
      await api.sendMessage(errorMessage, threadID, messageID);
    } finally {
      if (waitingMessage && waitingMessage.messageID) {
        api.unsendMessage(waitingMessage.messageID);
      }
    }
  }
};

// --- ฟังก์ชันสร้างหน้าเว็บ (ปรับปรุง Prompt และการตรวจสอบ) ---
async function buildPage(api, event, userPrompt, minutes, isUpdate, stateKey, filename, imageUrl = null) {
    const startTime = Date.now();
    const { senderID, threadID, messageID } = event;
    const fp = path.join(PAGE_DIR, filename);
    const HOST = "http://menu.panelaimbot.com:5000";

    let waitingMessage = await api.sendMessage("🤖 กำลังประมวลผลคำขอของคุณ...", threadID);

    try {
      // --- STEP 1: เรียกใช้ AI ---
      await api.editMessage("🚀 GPT-4O กำลังสร้างเว็บจากไอเดียของคุณ...", waitingMessage.messageID);
      
      let newApiUrl;
      let apiPrompt;
      const gptApiKey = "024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef";
      const geminiApiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";

      console.log(`[INFO] User ID: ${senderID} - Building page: ${userPrompt}`);

      // **[FIX]** ปรับปรุง Prompt ให้สั้นและชัดเจน เพื่อหลีกเลี่ยงข้อผิดพลาด Header Too Large
      const designInstructions = `สร้างเว็บ HTML สวยงาม มีส่วนประกอบ: CSS inline, responsive design, modern UI, animations, gradients, Google Fonts, Font Awesome icons`;

      const promptSuffix = `${designInstructions}. ตอบเป็นโค้ด HTML เดียว ขึ้นต้นด้วย <!DOCTYPE html>`;

      const roleplay = "รับบทเป็นผู้สร้างโค้ดhtml ทำสวยๆตาที่ผู้ใช้สั่งทั้งไอคอน";

      if (imageUrl) {
          console.log(`[INFO] Step 1: Using Gemini Flash 2.0 to read image. Image: ${imageUrl}, UID: ${senderID}`);
          
          // Step 1: ให้ Gemini Flash 2.0 อ่านภาพ
          await api.editMessage("🔍 Gemini Flash 2.0 กำลังอ่านและวิเคราะห์ภาพ...", waitingMessage.messageID);
          
          const imageAnalysisPrompt = `อธิบายภาพนี้สั้นๆ ในรูปแบบที่เหมาะสำหรับการสร้างเว็บไซต์${userPrompt ? ` ตามหัวข้อ: "${userPrompt.substring(0, 50)}"` : ''}`;
          const geminiApiUrl = `https://kaiz-apis.gleeze.com/api/gemini-flash-2.0?q=${encodeURIComponent(imageAnalysisPrompt)}&uid=${senderID}&imageUrl=${encodeURIComponent(imageUrl)}&apikey=${geminiApiKey}`;
          
          const imageAnalysisResponse = await axios.get(geminiApiUrl, {
            timeout: 180000,
            headers: { 'Accept-Encoding': 'gzip, deflate' }
          });
          
          if (imageAnalysisResponse.status !== 200 || (imageAnalysisResponse.data && imageAnalysisResponse.data.error)) {
            const errorMsg = imageAnalysisResponse.data.error || `Gemini API returned status ${imageAnalysisResponse.status}`;
            throw new Error(`Gemini API Error: ${errorMsg}`);
          }
          
          const imageDescription = imageAnalysisResponse.data.response;
          if (!imageDescription || typeof imageDescription !== 'string') {
            throw new Error("Gemini Flash 2.0 ไม่สามารถอ่านภาพได้");
          }
          
          console.log(`[INFO] Step 2: Using GPT-4O to create web based on image description`);
          
          // Step 2: ให้ GPT-4O สร้างเว็บจากคำอธิบายภาพ (ย่อเนื้อหาให้สั้น)
          await api.editMessage("🚀 GPT-4O กำลังสร้างเว็บจากข้อมูลภาพ...", waitingMessage.messageID);
          
          const shortDescription = truncatePrompt(imageDescription, 150);
          const shortUserPrompt = truncatePrompt(userPrompt, 50);
          
          apiPrompt = `สร้างเว็บ HTML สวยงาม จากภาพ: "${shortDescription}" ${shortUserPrompt ? `และไอเดีย: "${shortUserPrompt}"` : ''}. ${promptSuffix}`;
          
          // ตรวจสอบขนาด URL
          const testUrl = `https://haji-mix-api.gleeze.com/api/gpt4o?ask=${encodeURIComponent(apiPrompt)}&uid=${senderID}&roleplay=${encodeURIComponent(roleplay)}&api_key=${gptApiKey}`;
          
          if (!validateUrlLength(testUrl)) {
            const veryShortDesc = truncatePrompt(imageDescription, 50);
            apiPrompt = `สร้างเว็บ HTML จากภาพ: "${veryShortDesc}". มี CSS inline สวยงาม`;
          }
          
          var apiResponse = await axios.get('https://haji-mix-api.gleeze.com/api/gpt4o', {
            params: {
              ask: apiPrompt,
              uid: senderID,
              roleplay: roleplay,
              api_key: gptApiKey
            },
            timeout: 180000,
            headers: { 
              'Accept-Encoding': 'gzip, deflate'
            }
          }).catch(error => {
            // ถ้าเกิด error 431 (Header Too Large) ให้ลองใช้ prompt สั้นกว่า
            if (error.response && error.response.status === 431) {
              const veryShortDesc = truncatePrompt(imageDescription, 30);
              const simplePrompt = `สร้างเว็บจากภาพ: "${veryShortDesc}"`;
              
              return axios.get('https://haji-mix-api.gleeze.com/api/gpt4o', {
                params: {
                  ask: simplePrompt,
                  uid: senderID,
                  roleplay: "ช่วยสร้างเว็บ",
                  api_key: gptApiKey
                },
                timeout: 180000,
                headers: { 'Accept-Encoding': 'gzip, deflate' }
              });
            }
            throw error;
          });
      } else {
          console.log(`[INFO] Using GPT-4O text only. UID: ${senderID}`);
          await api.editMessage("🚀 GPT-4O กำลังสร้างเว็บจากไอเดียของคุณ...", waitingMessage.messageID);
          
          // ตัดไอเดียให้สั้นเพื่อหลีกเลี่ยง Header Too Large
          const shortPrompt = truncatePrompt(userPrompt, 150);
          apiPrompt = `สร้างเว็บ HTML สวยงาม สำหรับ: "${shortPrompt}". ${promptSuffix}`;
          
          // ตรวจสอบขนาด URL ก่อนส่ง request
          const testUrl = `https://haji-mix-api.gleeze.com/api/gpt4o?ask=${encodeURIComponent(apiPrompt)}&uid=${senderID}&roleplay=${encodeURIComponent(roleplay)}&api_key=${gptApiKey}`;
          
          if (!validateUrlLength(testUrl)) {
            // ถ้า URL ยาวเกินไป ให้ลดขนาด prompt อีก
            const veryShortPrompt = truncatePrompt(userPrompt, 50);
            apiPrompt = `สร้างเว็บ HTML สำหรับ: "${veryShortPrompt}". มี CSS inline สวยงาม responsive`;
          }
          
          var apiResponse = await axios.get('https://haji-mix-api.gleeze.com/api/gpt4o', {
            params: {
              ask: apiPrompt,
              uid: senderID,
              roleplay: roleplay,
              api_key: gptApiKey
            },
            timeout: 180000,
            headers: { 
              'Accept-Encoding': 'gzip, deflate'
            }
          }).catch(error => {
            // ถ้าเกิด error 431 (Header Too Large) ให้ลองใช้ prompt สั้นกว่า
            if (error.response && error.response.status === 431) {
              const veryShortPrompt = truncatePrompt(userPrompt, 30);
              const simplePrompt = `สร้างเว็บสำหรับ: "${veryShortPrompt}"`;
              
              return axios.get('https://haji-mix-api.gleeze.com/api/gpt4o', {
                params: {
                  ask: simplePrompt,
                  uid: senderID,
                  roleplay: "ช่วยสร้างเว็บ",
                  api_key: gptApiKey
                },
                timeout: 180000,
                headers: { 'Accept-Encoding': 'gzip, deflate' }
              });
            }
            throw error;
          });
      }
      
      console.log('[DEBUG] API Response Status:', apiResponse.status);
      console.log('[DEBUG] API Response:', JSON.stringify(apiResponse.data, null, 2));

      // ตรวจสอบ error จาก API
      if (apiResponse.status !== 200 || (apiResponse.data && apiResponse.data.error)) {
        const errorMsg = apiResponse.data.error || `API returned status ${apiResponse.status}`;
        throw new Error(`API Error: ${errorMsg}`);
      }

      const answer = apiResponse.data.answer;
      console.log('[DEBUG] AI Response length:', answer ? answer.length : 'null');
      console.log('[DEBUG] AI Response preview:', answer ? answer.substring(0, 200) + '...' : 'null');
      
      // Check if there are images in the response
      let imageAttachments = [];
      if (apiResponse.data.images && apiResponse.data.images.length > 0) {
        imageAttachments = apiResponse.data.images;
        console.log('[DEBUG] Found images in response:', imageAttachments.length);
      }
      
      if (!answer || typeof answer !== 'string') {
        throw new Error("GPT-4O ไม่ได้ให้คำตอบกลับมา หรือรูปแบบข้อมูลไม่ถูกต้อง");
      }
      
      // --- STEP 2: ดึงโค้ด HTML ---
      let html = null;
      
      // ลองหาโค้ดใน markdown block หลายรูปแบบ
      const patterns = [
        /```(?:html)?\s*([\s\S]+?)```/,  // ``` html ... ```
        /```\s*(<!DOCTYPE[\s\S]+?)```/,  // ``` <!DOCTYPE ... ```
        /```\s*(<html[\s\S]+?)```/,      // ``` <html ... ```
      ];
      
      let found = false;
      for (const pattern of patterns) {
        const match = answer.match(pattern);
        if (match && match[1]) {
          html = match[1].trim();
          found = true;
          console.log('[DEBUG] Found HTML in markdown block');
          break;
        }
      }
      
      // ถ้าไม่เจอใน markdown ให้ใช้ทั้งหมด
      if (!found) {
        html = answer.trim();
        console.log('[DEBUG] Using entire response as HTML');
      }

      // **[FIX]** ปรับปรุงการตรวจสอบ HTML ให้รองรับกรณีต่างๆ
      if (!html || typeof html !== 'string') {
        console.error("No HTML content received:", html);
        throw new Error("AI ไม่ได้ส่งเนื้อหากลับมา");
      }

      // ถ้าไม่ใช่ HTML ที่สมบูรณ์ ให้สร้าง template ห่อหุ้มแบบสวยๆ
      if (!/^<!DOCTYPE html|<html[\s>]/i.test(html)) {
        console.log("Wrapping content in professional HTML template");
        html = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Generated Web</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', sans-serif; 
            line-height: 1.6; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: rgba(255,255,255,0.95);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            backdrop-filter: blur(10px);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
        }
        .header h1 {
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
        }
        .content {
            animation: fadeInUp 0.8s ease-out;
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .btn {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            text-decoration: none;
            border-radius: 50px;
            transition: all 0.3s ease;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-magic"></i> AI Generated Web</h1>
            <p>สร้างโดย Gemini Flash 2.0 + GPT-4O</p>
        </div>
        <div class="content">
            ${html}
        </div>
    </div>
</body>
</html>`;
      }

      // --- STEP 3: บันทึกไฟล์และจัดการสถานะ ---
      fs.writeFileSync(fp, html);

      // --- STEP 3.5: อัปโหลดโค้ดไปยัง Pastebin ---
      await api.editMessage("📤 กำลังอัปโหลดโค้ดเพื่อให้ดูได้...", waitingMessage.messageID);
      const pastebinTitle = `Web Code - ${userPrompt ? userPrompt.substring(0, 50) : 'Generated Web'}`;
      const pastebinUrl = await uploadToPastebin(html, pastebinTitle);

      if (timeouts[stateKey]) clearTimeout(timeouts[stateKey]);
      const expiresAt = Date.now() + minutes * 60 * 1000;
      state[stateKey] = { 
        filename, 
        minutes, 
        expiresAt,
        pastebinUrl: pastebinUrl || null,
        createdAt: Date.now()
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      scheduleExpiry(stateKey, state[stateKey]);

      const durationInSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      const pageUrl = `${HOST}/pages/${filename}`;

      const sendFallbackMessage = async (reason) => {
        console.error(`[Screenshot Fallback] Reason: ${reason}`);
        const rec = state[stateKey];
        let fallbackBody = `✅ ${isUpdate ? "อัปเดต" : "สร้าง"}หน้าเว็บสำเร็จ! (แต่สร้างภาพตัวอย่างไม่ได้)\n` +
                           `🔗 ลิงก์:\n${pageUrl}\n` +
                           `⏱️ เวลาที่ใช้: ${durationInSeconds} วินาที\n` +
                           `🗑️ จะถูกลบใน: ${minutes} นาที`;
        
        if (rec && rec.pastebinUrl) {
          fallbackBody += `\n📄 ดูโค้ด: ${rec.pastebinUrl}`;
        }
        
        await api.sendMessage(fallbackBody, threadID, messageID);
        
        // Send generated images as attachments if any
        if (imageAttachments && imageAttachments.length > 0) {
          for (let i = 0; i < imageAttachments.length; i++) {
            const img = imageAttachments[i];
            try {
              // Download image and send as attachment
              const imageResponse = await axios.get(img.url, {
                responseType: 'stream',
                timeout: 30000
              });
              
              const imageMessage = {
                attachment: imageResponse.data
              };
              
              // Add description if available
              if (img.description) {
                imageMessage.body = `📷 ${img.description}`;
              }
              
              await api.sendMessage(imageMessage, threadID);
              
            } catch (imageError) {
              console.error("Error sending image:", imageError);
              // Fallback to sending URL if image download fails
              api.sendMessage(`📷 รูปภาพ ${i + 1}: ${img.url}${img.description ? `\n(${img.description})` : ''}`, threadID);
            }
          }
        }
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

        writer.on("finish", async () => {
          const rec = state[stateKey];
          let body = `✅ ${isUpdate ? "อัปเดต" : "สร้าง"}หน้าเว็บสำเร็จ!\n` +
                     `🔗 ลิงก์:\n${pageUrl}\n` +
                     `⏱️ เวลาที่ใช้: ${durationInSeconds} วินาที\n` +
                     `🗑️ จะถูกลบใน: ${minutes} นาที`;
          
          if (rec && rec.pastebinUrl) {
            body += `\n📄 ดูโค้ด: ${rec.pastebinUrl}`;
          }
          
          api.sendMessage(body, threadID, async (err, info) => {
              if (err) return console.error(err);
              
              // Send screenshot
              api.sendMessage({
                  attachment: fs.createReadStream(screenshotFilePath)
              }, threadID, async () => {
                  if (fs.existsSync(screenshotFilePath)) {
                      fs.unlinkSync(screenshotFilePath);
                  }
                  
                  // Send generated images as attachments if any
                  if (imageAttachments && imageAttachments.length > 0) {
                    for (let i = 0; i < imageAttachments.length; i++) {
                      const img = imageAttachments[i];
                      try {
                        // Download image and send as attachment
                        const imageResponse = await axios.get(img.url, {
                          responseType: 'stream',
                          timeout: 30000
                        });
                        
                        const imageMessage = {
                          attachment: imageResponse.data
                        };
                        
                        // Add description if available
                        if (img.description) {
                          imageMessage.body = `📷 ${img.description}`;
                        }
                        
                        await api.sendMessage(imageMessage, threadID);
                        
                      } catch (imageError) {
                        console.error("Error sending image:", imageError);
                        // Fallback to sending URL if image download fails
                        api.sendMessage(`📷 รูปภาพ ${i + 1}: ${img.url}${img.description ? `\n(${img.description})` : ''}`, threadID);
                      }
                    }
                  }
              });
          }, messageID);
        });

        writer.on("error", async (err) => {
          if (fs.existsSync(screenshotFilePath)) fs.unlinkSync(screenshotFilePath);
          await sendFallbackMessage(`Error writing image file: ${err.message}`);
        });

      } catch (screenshotError) {
        await sendFallbackMessage(`API call for screenshot failed: ${screenshotError.message}`);
      }

    } catch (e) {
      console.error('[ERROR]', e);
      let errorMessage = `❌ เกิดข้อผิดพลาดในการสร้างหน้าเว็บ\nสาเหตุ: ${e.message}`;
      
      if (e.response) {
        errorMessage += ` (Status: ${e.response.status})`;
        if (e.response.status === 431) {
          errorMessage += `\n💡 คำแนะนำ: ข้อความที่ใส่ยาวเกินไป ลองใช้ข้อความสั้นๆ กว่านี้`;
        }
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

// --- การตั้งค่า Pastebin API ---
  const PASTEBIN_API_KEY = "8ApRJDKLKO6sPUJeKID-2xFNF3Uq2Q02";
  const PASTEBIN_API_URL = "https://pastebin.com/api/api_post.php";

  // --- ฟังก์ชันอัปโหลดโค้ดไปยัง Pastebin ---
  async function uploadToPastebin(code, title = "Generated Web Code") {
    try {
      const params = new URLSearchParams({
        api_dev_key: PASTEBIN_API_KEY,
        api_option: "paste",
        api_paste_code: code,
        api_paste_name: title,
        api_paste_format: "html5",
        api_paste_private: "0", // 0=public, 1=unlisted, 2=private
        api_paste_expire_date: "1H" // 1 hour expiration
      });

      const response = await axios.post(PASTEBIN_API_URL, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      if (response.data && response.data.startsWith('https://pastebin.com/')) {
        return response.data.trim();
      } else {
        console.error('Pastebin error:', response.data);
        return null;
      }
    } catch (error) {
      console.error('Failed to upload to Pastebin:', error.message);
      return null;
    }
  }

// ฟังก์ชันตัดข้อความให้สั้นเพื่อหลีกเลี่ยงข้อผิดพลาด Header Too Large
function truncatePrompt(text, maxLength = 200) {
  if (!text || typeof text !== 'string') return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// ฟังก์ชันตรวจสอบขนาด URL ก่อนส่ง request
function validateUrlLength(url, maxLength = 8000) {
  return url.length <= maxLength;
}
