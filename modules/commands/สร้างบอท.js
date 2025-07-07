const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const axios = require("axios");
const { sendMessageWithAttachment, isFileReadable } = require("../../utils/messageUtils");

// --- การตั้งค่าโฟลเดอร์ ---
const CACHE_DIR = path.join(__dirname, "cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// --- ตัวจัดการสถานะบอทที่กำลังรัน ---
const runningBots = new Map();
const BOT_LIFETIME_MS = 15 * 60 * 1000; // 15 นาที

/**
 * ฟังก์ชันหลักในการสร้างโค้ดบอท, รัน, และส่งให้ผู้ใช้
 * @param {object} api - Object ของ API ที่ใช้ส่งข้อความ
 * @param {object} event - Object ของ Event ที่ได้รับ
 * @param {string} botToken - Token ของ Telegram Bot
 * @param {string} userPrompt - ไอเดียหรือคำสั่งสำหรับสร้างบอท
 * @param {string} prefix - Prefix ของคำสั่ง
 */
async function buildAndRunBot(api, event, botToken, userPrompt, prefix) {
  const startTime = Date.now();
  const { threadID, messageID, senderID } = event;
  let waitingMessage = null;

  try {
    waitingMessage = await api.sendMessage(
      "🤖 กำลังส่งไอเดียของคุณไปยัง AI...",
      threadID
    );

    // --- STEP 1: หยุดบอทเก่า (ถ้ามี) และตรวจสอบเวลา ---
    if (runningBots.has(senderID)) {
      const oldBot = runningBots.get(senderID);
      clearTimeout(oldBot.timerId);

      const timeElapsed = Date.now() - oldBot.createdAt;
      
      let stopMessage = "คุณมีบอทที่ทำงานอยู่แล้ว กำลังหยุดบอทเก่าเพื่อสร้างใหม่...";
      if (timeElapsed < BOT_LIFETIME_MS) {
          stopMessage = "⏳ ตรวจพบเซสชันเก่า กำลังแก้ไขโค้ดบอทของคุณ...";
      }
      
      await api.editMessage(stopMessage, waitingMessage.messageID);
      
      // [FIX] เพิ่มความรัดกุมในการปิดโปรเซสเก่า
      await new Promise((resolve) => {
        const pid = oldBot.process.pid;
        let resolved = false;

        const onExit = () => {
            if (!resolved) {
                console.log(`[INFO] Confirmed exit for old bot process PID: ${pid}.`);
                resolved = true;
                resolve();
            }
        };
        oldBot.process.on('exit', onExit);

        console.log(`[INFO] Kill signal (SIGTERM) sent to old bot PID: ${pid}. Waiting for graceful exit...`);
        oldBot.process.kill('SIGTERM'); 
        runningBots.delete(senderID);

        setTimeout(() => {
            if (!resolved) {
                console.warn(`[WARN] Old bot PID: ${pid} did not exit gracefully. Sending SIGKILL.`);
                try {
                    process.kill(pid, 'SIGKILL');
                } catch (e) {
                    // Ignore error if process is already gone
                }
                resolved = true;
                resolve();
            }
        }, 4000); // รอ 4 วินาที
      });
    }

    // --- STEP 2: เตรียม Prompt และเรียกใช้ AI ---
    await api.editMessage("🚀 AI กำลังเนรมิตโค้ดบอท Telegram...", waitingMessage.messageID);
    
    const fullPrompt = `
      You are an expert in creating Telegram bots using Node.js.
      Your task is to generate a complete, single-file Node.js code for a Telegram bot using the 'node-telegram-bot-api' library.
      The code must follow these strict rules:
      1. Directly embed the following TOKEN into the code: '${botToken}'
      2. The code must be ready to run immediately with 'node <filename>.js', assuming 'node-telegram-bot-api' is already installed.
      3. Your response MUST be only the raw code.
      4. Your response MUST start with "const TelegramBot = require('node-telegram-bot-api');".
      5. Do NOT include any markdown like \`\`\`javascript, explanations, comments, or any other text outside of the code itself.
      The main idea for the bot is: "${userPrompt}"
    `;
    
    const newApiUrl = 'https://bots.easy-peasy.ai/bot/9bc091b4-8477-4844-8b53-a354244f53e8/api';
    const newApiKey = '5528a40e-e4cc-4414-bb01-995f43a55949';

    const response = await axios.post(newApiUrl, {
      "message": fullPrompt,
      "history": [],
      "stream": false,
      "include_sources": false
    }, {
      headers: {
        'content-type': 'application/json',
        'x-api-key': newApiKey
      },
      timeout: 180000
    });

    console.log("[DEBUG] New AI Response:", JSON.stringify(response.data, null, 2));

    let generatedCode = response.data.bot.text;

    if (!generatedCode || typeof generatedCode !== "string" || !generatedCode.includes("node-telegram-bot-api")) {
      throw new Error("AI ไม่ได้ส่งโค้ดกลับมา หรือรูปแบบโค้ดไม่ถูกต้อง (อาจต้องตรวจสอบ response.data.bot.text)");
    }

    // --- STEP 3: ติดตั้ง Dependencies, บันทึก และรันโค้ด ---
    await api.editMessage("⚙️ กำลังตรวจสอบและติดตั้งไลบรารีที่จำเป็น...", waitingMessage.messageID);
    try {
        execSync('npm install node-telegram-bot-api', { stdio: 'inherit' });
        console.log('[INFO] Dependency "node-telegram-bot-api" is installed or already present.');
    } catch (installError) {
        console.error('[ERROR] Failed to install dependency:', installError);
        throw new Error('ไม่สามารถติดตั้งไลบรารี "node-telegram-bot-api" ได้');
    }
    
    const shutdownHandler = `
\n// --- Graceful Shutdown Handler ---
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing Telegram bot polling.');
  bot.stopPolling({ cancel: true }).then(() => {
    console.log('Telegram bot polling stopped. Exiting process.');
    process.exit(0);
  }).catch(err => {
    console.error('Error stopping polling:', err);
    process.exit(1);
  });
});
`;
    generatedCode += shutdownHandler;
    
    await api.editMessage("⚙️ กำลังบันทึกและเตรียมรันบอท...", waitingMessage.messageID);
    const fileName = `telegram_bot_${senderID}_${Date.now()}.js`;
    const filePath = path.join(CACHE_DIR, fileName);
    fs.writeFileSync(filePath, generatedCode);

    let botStderr = '';
    const botProcess = spawn('node', [filePath], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    botProcess.unref();

    botProcess.stderr.on('data', (data) => {
        console.error(`[BOT STDERR ${botProcess.pid}]: ${data}`);
        botStderr += data.toString();
    });

    botProcess.on('exit', (code) => {
      console.log(`[INFO] Bot process for user ${senderID} (PID: ${botProcess.pid}) exited with code ${code}.`);
      const botInfo = runningBots.get(senderID);

      if (code !== 0 && botInfo) {
          const timeAlive = Date.now() - botInfo.createdAt;
          if (timeAlive < 10000) { 
              const errorMessage = `🔴 บอทของคุณหยุดทำงานกะทันหัน (exit code: ${code}).\nสาเหตุอาจเกิดจากข้อผิดพลาดในโค้ดที่ AI สร้างขึ้น\n\n**Error Log:**\n\`\`\`\n${botStderr || 'No specific error message was captured.'}\n\`\`\``;
              api.sendMessage(errorMessage, threadID);
          }
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[CLEANUP] Deleted bot file: ${filePath}`);
      }
      if (botInfo && botInfo.process.pid === botProcess.pid) {
        clearTimeout(botInfo.timerId);
        runningBots.delete(senderID);
      }
    });

    botProcess.on('error', (err) => {
      console.error(`[ERROR] Failed to start or run bot process for user ${senderID}:`, err);
      if (runningBots.has(senderID) && runningBots.get(senderID).process.pid === botProcess.pid) {
        runningBots.delete(senderID);
      }
    });

    const autoStopTimer = setTimeout(() => {
        if (runningBots.has(senderID) && runningBots.get(senderID).process.pid === botProcess.pid) {
            botProcess.kill('SIGTERM');
            console.log(`[AUTO-STOP] Bot for user ${senderID} (PID: ${botProcess.pid}) stopped after 15 minutes.`);
            api.sendMessage(`⏰ บอทของคุณสำหรับไอเดีย: "${userPrompt.substring(0, 30)}..." ได้หยุดทำงานแล้วเนื่องจากครบกำหนด 15 นาที`, threadID);
        }
    }, BOT_LIFETIME_MS);

    runningBots.set(senderID, { 
        process: botProcess, 
        filePath: filePath,
        createdAt: Date.now(),
        timerId: autoStopTimer 
    });
    console.log(`[INFO] Started bot for user ${senderID} with PID: ${botProcess.pid}. Auto-stop scheduled in 15 mins.`);

    // --- STEP 4: ส่งข้อความยืนยันและไฟล์ ---
    const durationInSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    const body = `✅ สร้างและรันบอท Telegram สำเร็จ!\n\nสถานะ: บอทของคุณกำลังทำงานอยู่...\n\n💬 ไอเดีย: ${userPrompt}\n⏱️ เวลาที่ใช้: ${durationInSeconds} วินาที\n\n⏰ บอทนี้จะหยุดทำงานอัตโนมัติใน 15 นาที\n\nหากต้องการหยุดก่อนเวลา ให้ใช้คำสั่ง:\n\`${prefix}สร้างบอท stop\`\n\n(ไฟล์โค้ดแนบมาด้วยเผื่อต้องการดู)`;

    await new Promise(resolve => setTimeout(resolve, 1500)); 

    // ตรวจสอบว่าไฟล์ยังคงมีอยู่ก่อนส่ง
    if (!fs.existsSync(filePath)) {
      console.warn(`[WARN] Bot file was deleted before sending: ${filePath}`);
      return api.sendMessage(body, threadID, messageID);
    }

    // ใช้ utility function สำหรับส่งข้อความพร้อมไฟล์แนบ
    try {
      await sendMessageWithAttachment(api, body, threadID, messageID, filePath);
    } catch (attachmentError) {
      console.error("[ERROR] Failed to send message with attachment, sending text only:", attachmentError);
      // ส่งเฉพาะข้อความถ้าไฟล์แนบไม่ได้
      await api.sendMessage(body, threadID, messageID);
    }

  } catch (e) {
    console.error(e);
    let errorMessage = `❌ เกิดข้อผิดพลาดในการสร้างบอท\nสาเหตุ: ${e.message}`;
    if (e.response) errorMessage += ` (Status: ${e.response.status})`;
    await api.sendMessage(errorMessage, threadID, messageID);
  } finally {
    if (waitingMessage && waitingMessage.messageID) {
      api.unsendMessage(waitingMessage.messageID);
    }
  }
}

// --- โครงสร้างคำสั่งหลัก ---
module.exports = {
  name: "สร้างบอท",
  description: "สร้างและรันโค้ดบอท Telegram จากไอเดียของคุณโดยใช้ AI (ทำงาน 15 นาที)",
  version: "4.0.0", // Update version with robust shutdown
  aliases: ["createbot", "tgbot", "telebot"],
  nashPrefix: false,
  cooldowns: 60,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, senderID } = event;

    if (args[0] && args[0].toLowerCase() === 'stop') {
      if (runningBots.has(senderID)) {
        const botToStop = runningBots.get(senderID);
        clearTimeout(botToStop.timerId);
        botToStop.process.kill('SIGTERM');
        runningBots.delete(senderID);
        return api.sendMessage("✅ บอทของคุณถูกสั่งให้หยุดการทำงานแล้ว", threadID, messageID);
      } else {
        return api.sendMessage("❌ คุณไม่มีบอทที่กำลังทำงานอยู่", threadID, messageID);
      }
    }

    const fullArgs = args.join(' ');
    const tokenRegex = /(\d{8,10}:[a-zA-Z0-9_-]{35})/;
    const tokenMatch = fullArgs.match(tokenRegex);

    if (!tokenMatch) {
      return api.sendMessage(
        `❌ ไม่พบ Token ของ Telegram ในคำสั่ง!\n\nโปรดระบุ Token และไอเดียสำหรับสร้างบอท\n\nตัวอย่าง:\n${prefix}สร้างบอท 123456:ABC-DEF บอททวนคำพูด`,
        threadID,
        messageID
      );
    }

    const botToken = tokenMatch[0];
    const userPrompt = fullArgs.replace(tokenRegex, '').replace(/\s+/g, ' ').trim();

    if (!userPrompt) {
      return api.sendMessage(
        `📝 โปรดระบุไอเดียสำหรับบอทของคุณด้วย\n\nตัวอย่าง:\n${prefix}สร้างบอท ${botToken} บอททวนคำพูด`,
        threadID,
        messageID
      );
    }

    return buildAndRunBot(api, event, botToken, userPrompt, prefix);
  },
};
