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
  // โครงสร้าง state ใหม่: { uid: { stateKey: { ... } } }
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
 // อัปเดตการตั้งเวลาลบให้ทำงานกับโครงสร้างใหม่
 Object.entries(state).forEach(([uid, userPages]) => {
    if (userPages) { // เพิ่มการตรวจสอบว่า userPages ไม่ใช่ null
        Object.entries(userPages).forEach(([stateKey, rec]) => {
            scheduleExpiry(uid, stateKey, rec);
        });
    }
 });

 function scheduleExpiry(uid, stateKey, rec) {
  if (!rec || !rec.expiresAt) return;
  const msLeft = rec.expiresAt - Date.now();
  const timeoutKey = `${uid}-${stateKey}`;
  if (msLeft <= 0) {
    return deletePage(uid, stateKey);
  }
  timeouts[timeoutKey] = setTimeout(() => deletePage(uid, stateKey), msLeft);
 }

 function deletePage(uid, stateKey) {
  if (!state[uid] || !state[uid][stateKey]) return;

  const rec = state[uid][stateKey];
  const timeoutKey = `${uid}-${stateKey}`;
  
  // เพิ่มการตรวจสอบ rec ก่อนเข้าถึง filename
  if (!rec || !rec.filename) {
      console.error(`Attempted to delete a page with invalid record for UID ${uid}, stateKey ${stateKey}`);
      delete state[uid][stateKey];
      if (Object.keys(state[uid]).length === 0) {
          delete state[uid];
      }
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      return;
  }

  const fp = path.join(PAGE_DIR, rec.filename);
  try {
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      console.log(`🗑️ Deleted page for UID ${uid}: ${rec.filename}`);
    }
    delete state[uid][stateKey];
    if (Object.keys(state[uid]).length === 0) {
        delete state[uid];
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    clearTimeout(timeouts[timeoutKey]);
  } catch (err) {
    console.error(`Failed to delete page ${rec.filename} for UID ${uid}:`, err);
  }
 }

 // --- โครงสร้างคำสั่งหลัก ---
 module.exports = {
  name: "สร้างเว็บ",
  description: "สร้างเว็บเพจส่วนตัวจากไอเดียหรือรูปภาพ โดย AI Gemini Vision (ของใครของมัน)",
  version: "8.5.2", // อัปเดตเวอร์ชัน - แก้ไขข้อผิดพลาด 'filename' is null
  aliases: ["createweb", "webai", "htmlai", "สร้างหน้าเว็บ", "viewcode", "ดูโค้ด", "รายละเอียด", "แก้ไข", "edit", "list"],
  nashPrefix: false,
  cooldowns: 30,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, senderID, type, messageReply } = event;
    
    if (args.length > 0) {
        const subCommand = args[0].toLowerCase();
        if (['viewcode', 'ดูโค้ด'].includes(subCommand)) {
            return await this.handleViewCode(api, event, args.slice(1));
        }
        if (['รายละเอียด', 'list', 'ลิสต์'].includes(subCommand)) {
            return await this.handleListDetails(api, event);
        }
        if (['แก้ไข', 'edit'].includes(subCommand)) {
            return await this.handleEdit(api, event, args.slice(1));
        }
    }
    
    let inputArgs = [...args];
    let prompt = "";
    let minutes = 5;
    let imageUrl = null;

    if (type === "message_reply" && messageReply.attachments && messageReply.attachments.some(att => att.type === "photo")) {
        imageUrl = messageReply.attachments.find(att => att.type === "photo").url;
        prompt = inputArgs.join(" ").trim();
    } else {
        const urlRegex = /(https?:\/\/[^\s]+)/;
        const urlArg = inputArgs.find(arg => urlRegex.test(arg) && /\.(jpg|png|jpeg)$/i.test(arg));
        if (urlArg) {
            imageUrl = urlArg;
            inputArgs = inputArgs.filter(arg => arg !== urlArg);
        }
        if (inputArgs.length > 0) {
            const lastArg = inputArgs[inputArgs.length - 1];
            const potentialMinutes = parseInt(lastArg, 10);
            if (!isNaN(potentialMinutes) && potentialMinutes >= 1 && potentialMinutes <= 60) {
                minutes = potentialMinutes;
                inputArgs.pop();
            }
        }
        prompt = inputArgs.join(" ").trim();
    }

    if (!prompt && !imageUrl) {
      return api.sendMessage(
        `📝 โปรดระบุไอเดียสำหรับสร้างเว็บ หรือ Reply รูปภาพ\n\n` +
        `🤖 ใช้ Gemini Vision (เว็บที่สร้างเป็นของคุณส่วนตัว)\n\n` +
        `📋 คำสั่งต่างๆ:\n` +
        `🔸 สร้างเว็บ: ${prefix}สร้างเว็บ เว็บไซต์ขายดอกไม้ 15\n` +
        `🔸 ดูรายละเอียด: ${prefix}สร้างเว็บ รายละเอียด\n` +
        `🔸 แก้ไขเว็บ: ${prefix}สร้างเว็บ แก้ไข ชื่อไฟล์\n` +
        `🔸 ดูโค้ด: ${prefix}สร้างเว็บ ดูโค้ด all\n\n` +
        `✨ เว็บของคุณจะถูกจัดการแยกกับผู้ใช้อื่น\n` +
        `(เวลาที่กำหนดได้ 1-60 นาที)`,
        threadID,
        messageID
      );
    }
    
    const statePrompt = prompt || imageUrl;
    const stateKey = slugify(statePrompt);

    if (!state[senderID]) {
        state[senderID] = {};
    }
    
    const existingState = state[senderID][stateKey];

    if (existingState && existingState.filename) {
      let existingMessage = `✏️ พบหน้าเว็บเดิมของคุณจากไอเดียนี้ (จะถูกลบใน ${Math.ceil((existingState.expiresAt - Date.now()) / 60000)} นาที)\n`;
      if (existingState.pastebinUrl) {
        existingMessage += `📄 ดูโค้ดเดิม: ${existingState.pastebinUrl}\n`;
      }
      existingMessage += `กำลังสร้างทับ...`;
      await api.sendMessage(existingMessage, threadID, messageID);
      return buildPage(api, event, prompt, minutes, true, stateKey, existingState.filename, imageUrl);
    }
    
    // [FIX] เพิ่มการกรอง rec ที่เป็น null ออกก่อนที่จะ map เอา filename
    const allFilenames = Object.values(state)
        .flatMap(userPages => Object.values(userPages)
            .filter(rec => rec && rec.filename) // กรอง rec ที่ไม่ถูกต้องออก
            .map(rec => rec.filename)
        );

    let newFilename = generateRandomFilename();
    while (allFilenames.includes(newFilename)) {
        newFilename = generateRandomFilename();
    }
    return buildPage(api, event, prompt, minutes, false, stateKey, newFilename, imageUrl);
  },

  async handleViewCode(api, event, args) {
    const { threadID, messageID, senderID } = event;
    const userPages = state[senderID] || {};

    if (args.length === 0) {
      return api.sendMessage(`📋 การใช้งาน: ดูโค้ด <all|ไอเดียของคุณ>`, threadID, messageID);
    }

    const query = args.join(" ").trim().toLowerCase();
    
    if (query === "all" || query === "ทั้งหมด") {
      const activePages = Object.entries(userPages).filter(([key, rec]) => rec && rec.pastebinUrl);
      if (activePages.length === 0) {
        return api.sendMessage(`📄 คุณยังไม่ได้สร้างเว็บเพจใดๆ ที่มีโค้ดให้ดู`, threadID, messageID);
      }
      
      let message = `📋 รายการโค้ดเว็บของคุณ (${activePages.length} เว็บ):\n\n`;
      activePages.forEach(([key, rec], index) => {
        const minutesLeft = Math.ceil((rec.expiresAt - Date.now()) / 60000);
        message += `${index + 1}. 🌐 ${key.replace(/-/g, ' ')}\n`;
        message += `    📄 โค้ด: ${rec.pastebinUrl}\n`;
        message += `    ⏰ เหลือเวลา: ${minutesLeft > 0 ? minutesLeft : 0} นาที\n\n`;
      });
      return api.sendMessage(message, threadID, messageID);

    } else {
      const searchKey = slugify(query);
      const foundState = userPages[searchKey];
      
      if (!foundState || !foundState.pastebinUrl) {
        return api.sendMessage(`❌ ไม่พบเว็บของคุณที่สร้างจากไอเดีย "${query}" หรือยังไม่มีลิงก์โค้ด`, threadID, messageID);
      }
      
      const minutesLeft = Math.ceil((foundState.expiresAt - Date.now()) / 60000);
      const HOST = "http://menu.panelaimbot.com:5000";
      const pageUrl = `${HOST}/pages/${foundState.filename}`;
      
      return api.sendMessage(
        `📄 พบโค้ดสำหรับเว็บของคุณ: "${query}"\n\n` +
        `🔗 ลิงก์เว็บ: ${pageUrl}\n` +
        `📄 ดูโค้ด: ${foundState.pastebinUrl}\n` +
        `⏰ เหลือเวลา: ${minutesLeft > 0 ? minutesLeft : 0} นาที`,
        threadID,
        messageID
      );
    }
  },

  async handleListDetails(api, event) {
    const { threadID, messageID, senderID } = event;
    const userPages = state[senderID] || {};
    const activePages = Object.entries(userPages).filter(([key, rec]) => rec && rec.filename);
    
    if (activePages.length === 0) {
      return api.sendMessage(`📄 คุณยังไม่ได้สร้างเว็บเพจใดๆ`, threadID, messageID);
    }
    
    let message = `📋 รายละเอียดเว็บของคุณ (${activePages.length} เว็บ):\n\n`;
    activePages.forEach(([key, rec], index) => {
      const minutesLeft = Math.ceil((rec.expiresAt - Date.now()) / 60000);
      const HOST = "http://menu.panelaimbot.com:5000";
      const pageUrl = `${HOST}/pages/${rec.filename}`;
      
      message += `${index + 1}. 🌐 **${key.replace(/-/g, ' ')}**\n`;
      message += `    📁 ไฟล์: \`${rec.filename}\`\n`;
      message += `    🔗 ลิงก์: ${pageUrl}\n`;
      message += `    ⏰ เหลือเวลา: ${minutesLeft > 0 ? minutesLeft + ' นาที' : 'หมดเวลาแล้ว'}\n`;
      message += `    ✏️ แก้ไข: \`สร้างเว็บ แก้ไข ${rec.filename}\`\n\n`;
    });
    return api.sendMessage(message, threadID, messageID);
  },

  async handleEdit(api, event, args) {
    const { threadID, messageID, senderID } = event;
    const userPages = state[senderID] || {};

    if (args.length < 2) {
      return api.sendMessage(`📝 กรุณาระบุชื่อไฟล์และคำสั่งแก้ไข\n\nตัวอย่าง: \`สร้างเว็บ แก้ไข dream.html เปลี่ยนพื้นหลังเป็นสีดำ\``, threadID, messageID);
    }
    
    const filename = args[0];
    const editRequest = args.slice(1).join(" ");
    const foundEntry = Object.entries(userPages).find(([key, rec]) => rec && rec.filename === filename);
    
    if (!foundEntry) {
      return api.sendMessage(`❌ ไม่พบไฟล์ชื่อ "${filename}" ในเว็บของคุณ\n\n💡 ดูรายชื่อไฟล์ของคุณ: \`สร้างเว็บ รายละเอียด\``, threadID, messageID);
    }
    
    const [stateKey, rec] = foundEntry;
    return await performEdit(api, event, stateKey, rec, editRequest);
  },
 };
 
 async function performEdit(api, event, stateKey, rec, editRequest) {
    const { threadID, messageID, senderID } = event;
    const fp = path.join(PAGE_DIR, rec.filename);
    const HOST = "http://menu.panelaimbot.com:5000";
    
    let waitingMessage = await api.sendMessage(`🔧 กำลังแก้ไขไฟล์ \`${rec.filename}\`...`, threadID);
    
    try {
      if (!fs.existsSync(fp)) throw new Error("ไฟล์เดิมไม่พบ อาจถูกลบไปแล้ว");
      const existingHtml = fs.readFileSync(fp, 'utf8');
      
      await api.editMessage("🤖 Gemini Vision กำลังวิเคราะห์และแก้ไขโค้ด...", waitingMessage.messageID);
      
      const editPrompt = `แก้ไขโค้ด HTML นี้ตามคำขอ: "${editRequest}"\n\nโค้ดเดิม:\n${existingHtml}\n\nกรุณาส่งโค้ด HTML ที่แก้ไขแล้วกลับมาเท่านั้น ขึ้นต้นด้วย <!DOCTYPE html> ห้ามใส่ markdown หรือคำอธิบาย แก้เฉพาะส่วนที่ขอมา`;
      const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const anonymousUID = "edit_" + Math.random().toString(36).substring(2, 10); // UID แบบสุ่มไม่จดจำ
      const newApiUrl = `https://kaiz-apis.gleeze.com/api/gemini-vision?q=${encodeURIComponent(editPrompt)}&uid=${anonymousUID}&imageUrl=&apikey=${apiKey}`;
      
      const apiResponse = await axios.get(newApiUrl, { timeout: 180000 });
      
      if (apiResponse.status !== 200 || (apiResponse.data && apiResponse.data.error)) {
        throw new Error(`API Error: ${apiResponse.data.error || `status ${apiResponse.status}`}`);
      }

      const answer = apiResponse.data.response || apiResponse.data.message;
      if (!answer || typeof answer !== 'string') throw new Error("Gemini Vision ไม่ได้ให้คำตอบกลับมา");
      
      let editedHtml = answer.match(/```(?:html)?\s*([\s\S]+?)```/)?.[1]?.trim() || answer.trim();
      if (!editedHtml) throw new Error("ไม่สามารถดึงโค้ดที่แก้ไขได้");
      
      if (!/^<!DOCTYPE html|<html[\s>]/i.test(editedHtml)) {
        editedHtml = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Edited Web</title></head><body>${editedHtml}</body></html>`;
      }
      
      fs.writeFileSync(fp, editedHtml);
      
      await api.editMessage("📤 กำลังอัปโหลดโค้ดที่แก้ไขแล้ว...", waitingMessage.messageID);
      const pastebinUrl = await uploadToPastebin(editedHtml, `Edited - ${rec.filename}`);
      
      state[senderID][stateKey].pastebinUrl = pastebinUrl || state[senderID][stateKey].pastebinUrl;
      state[senderID][stateKey].lastEdited = Date.now();
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      
      const pageUrl = `${HOST}/pages/${rec.filename}`;
      let successMessage = `✅ แก้ไขเว็บของคุณสำเร็จ!\n📝 การแก้ไข: ${editRequest}\n🔗 ลิงก์: ${pageUrl}\n`;
      if (pastebinUrl) successMessage += `📄 โค้ดใหม่: ${pastebinUrl}\n`;
      successMessage += `⏰ เหลือเวลา: ${Math.ceil((rec.expiresAt - Date.now()) / 60000)} นาที`;
      
      await api.sendMessage(successMessage, threadID, messageID);
      
    } catch (error) {
      console.error('[EDIT ERROR]', error);
      await api.sendMessage(`❌ เกิดข้อผิดพลาดในการแก้ไข: ${error.message}`, threadID, messageID);
    } finally {
      if (waitingMessage && waitingMessage.messageID) api.unsendMessage(waitingMessage.messageID);
    }
 }

 async function buildPage(api, event, userPrompt, minutes, isUpdate, stateKey, filename, imageUrl = null) {
    const startTime = Date.now();
    const { senderID, threadID, messageID } = event;
    const fp = path.join(PAGE_DIR, filename);
    const HOST = "http://menu.panelaimbot.com:5000";

    let waitingMessage = await api.sendMessage("🤖 กำลังส่งไอเดียของคุณไปยัง Gemini Vision...", threadID);

    try {
      await api.editMessage("🚀 Gemini Vision กำลังสร้างเว็บจากไอเดียของคุณ...", waitingMessage.messageID);
      
      const apiKey = "e62d60dd-8853-4233-bbcb-9466b4cbc265";
      const anonymousUID = "webgen_" + Math.random().toString(36).substring(2, 10); // UID แบบสุ่มไม่จดจำ
      const promptSuffix = `ตอบเป็นโค้ด HTML เดียว ขึ้นต้นด้วย <!DOCTYPE html> ห้ามใส่ markdown หรือคำอธิบาย`;
      let apiPrompt = `สร้างเว็บไซต์ HTML+CSS+JS สำหรับ: "${userPrompt}". ${promptSuffix}`;
      let newApiUrl = `https://kaiz-apis.gleeze.com/api/gemini-vision?q=${encodeURIComponent(apiPrompt)}&uid=${anonymousUID}&imageUrl=&apikey=${apiKey}`;

      if (imageUrl) {
          apiPrompt = `สร้างเว็บไซต์ HTML+CSS+JS จากภาพและไอเดีย: "${userPrompt || 'ตามภาพ'}". ${promptSuffix}`;
          newApiUrl = `https://kaiz-apis.gleeze.com/api/gemini-vision?q=${encodeURIComponent(apiPrompt)}&uid=${anonymousUID}&imageUrl=${encodeURIComponent(imageUrl)}&apikey=${apiKey}`;
      }
      
      const apiResponse = await axios.get(newApiUrl, { timeout: 180000 });
      
      if (apiResponse.status !== 200 || (apiResponse.data && apiResponse.data.error)) {
        throw new Error(`API Error: ${apiResponse.data.error || `status ${apiResponse.status}`}`);
      }
      
      const answer = apiResponse.data.response || apiResponse.data.message;
      if (!answer || typeof answer !== 'string') throw new Error("Gemini Vision ไม่ได้ให้คำตอบกลับมา");
      
      let html = answer.match(/```(?:html)?\s*([\s\S]+?)```/)?.[1]?.trim() || answer.trim();
      if (!html) throw new Error("AI ไม่ได้ส่งเนื้อหากลับมา");

      if (!/^<!DOCTYPE html|<html[\s>]/i.test(html)) {
        html = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>AI Generated Web</title></head><body>${html}</body></html>`;
      }

      fs.writeFileSync(fp, html);

      await api.editMessage("📤 กำลังอัปโหลดโค้ดเพื่อให้ดูได้...", waitingMessage.messageID);
      const pastebinUrl = await uploadToPastebin(html, `Web Code - ${userPrompt.substring(0, 50)}`);

      const timeoutKey = `${senderID}-${stateKey}`;
      if (timeouts[timeoutKey]) clearTimeout(timeouts[timeoutKey]);
      
      const expiresAt = Date.now() + minutes * 60 * 1000;
      state[senderID][stateKey] = { filename, minutes, expiresAt, pastebinUrl, createdAt: Date.now() };
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      scheduleExpiry(senderID, stateKey, state[senderID][stateKey]);

      const durationInSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
      const pageUrl = `${HOST}/pages/${filename}`;

      const sendFallbackMessage = (reason) => {
        console.error(`[Screenshot Fallback] Reason: ${reason}`);
        let fallbackBody = `✅ ${isUpdate ? "อัปเดต" : "สร้าง"}เว็บสำเร็จ! (แต่สร้างภาพตัวอย่างไม่ได้)\n` +
                              `🔗 ลิงก์: ${pageUrl}\n` +
                              `⏱️ เวลา: ${durationInSeconds} วิ | 🗑️ ลบใน: ${minutes} นาที`;
        if (pastebinUrl) fallbackBody += `\n📄 โค้ด: ${pastebinUrl}`;
        api.sendMessage(fallbackBody, threadID, messageID);
      };

      try {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const screenshotApiUrl = `https://kaiz-apis.gleeze.com/api/screenshot?url=${encodeURIComponent(pageUrl)}&apikey=${apiKey}`;
        const screenshotFilePath = path.join(CACHE_DIR, `screenshot_${Date.now()}.png`);
        const writer = fs.createWriteStream(screenshotFilePath);
        const imageRes = await axios({ url: screenshotApiUrl, method: 'GET', responseType: 'stream', timeout: 60000 });
        imageRes.data.pipe(writer);

        writer.on("finish", () => {
          // ส่งข้อความก่อน
          let body = `✅ ${isUpdate ? "อัปเดต" : "สร้าง"}เว็บสำเร็จ!\n` +
                       `🔗 ลิงก์: ${pageUrl}\n` +
                       `⏱️ เวลา: ${durationInSeconds} วิ | 🗑️ ลบใน: ${minutes} นาที`;
          if (pastebinUrl) body += `\n📄 โค้ด: ${pastebinUrl}`;
          
          api.sendMessage(body, threadID, messageID);
          
          // รอสักพัก แล้วส่งภาพตัวอย่าง
          setTimeout(() => {
            api.sendMessage({ 
              body: "📸 ภาพตัวอย่างเว็บของคุณ:", 
              attachment: fs.createReadStream(screenshotFilePath) 
            }, threadID, (err) => {
              if (fs.existsSync(screenshotFilePath)) {
                  fs.unlinkSync(screenshotFilePath);
              }
              if (err) console.error(err);
            });
          }, 1500);
        });
        writer.on("error", (err) => {
          if (fs.existsSync(screenshotFilePath)) fs.unlinkSync(screenshotFilePath);
          sendFallbackMessage(`Error writing image file: ${err.message}`);
        });
      } catch (screenshotError) {
        sendFallbackMessage(`Screenshot API failed: ${screenshotError.message}`);
      }

    } catch (e) {
      console.error('[ERROR]', e);
      await api.sendMessage(`❌ เกิดข้อผิดพลาด: ${e.message}`, threadID, messageID);
    } finally {
      if (waitingMessage && waitingMessage.messageID) api.unsendMessage(waitingMessage.messageID);
    }
 }

 async function uploadToPastebin(code, title = "Generated Web Code") {
    try {
      const PASTEBIN_API_KEY = "8ApRJDKLKO6sPUJeKID-2xFNF3Uq2Q02";
      const params = new URLSearchParams({
        api_dev_key: PASTEBIN_API_KEY,
        api_option: "paste",
        api_paste_code: code,
        api_paste_name: title,
        api_paste_format: "html5",
        api_paste_private: "0",
        api_paste_expire_date: "1H"
      });
      const response = await axios.post("https://pastebin.com/api/api_post.php", params, { timeout: 30000 });
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

