const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const webServerManager = require('../../utils/webServerManager');

// Global server instance to prevent multiple servers
let globalServer = null;
let globalApp = null;

// Initialize static server on port 1437 when command loads
const initializeStaticServer = () => {
  // Check if server already exists
  if (globalServer) {
    return globalServer;
  }

  globalApp = express();
  const port = 1437;

  // Serve static files from iove directory
  globalApp.use('/iove', express.static(path.join(__dirname, '../../iove')));
  globalApp.use(express.static(path.join(__dirname, '../../iove')));

  // Default route
  globalApp.get('/', (req, res) => {
    res.send(`
      <html>
        <head>
          <title>LoveYoyBot Web Server</title>
          <meta charset="utf-8">
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <h1 style="color: white;">🌐 LoveYoyBot Web Server</h1>
          <p style="color: white; font-size: 18px;">พอร์ต 1437 พร้อมใช้งาน</p>
          <p style="color: white;">ใช้คำสั่ง "รันเว็บ" เพื่อสร้างเว็บไซต์</p>
        </body>
      </html>
    `);
  });

  try {
    globalServer = globalApp.listen(port, '0.0.0.0', () => {
      console.log(`[WEB SERVER] LoveYoyBot Web Server running on port ${port}`);
    });

    globalServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.log(`[WEB SERVER] Port ${port} is already in use`);
        globalServer = null;
        globalApp = null;
      }
    });

    return globalServer;
  } catch (error) {
    console.error('[WEB SERVER] Error starting server:', error);
    globalServer = null;
    globalApp = null;
    return null;
  }
};

// Initialize server when module loads (only if not already running)
setTimeout(() => {
  initializeStaticServer();
}, 1000);

module.exports = {
  name: 'รันเว็บ',
  description: 'รันเว็บไซต์จาก HTML ที่วางใน Pastebin บนพอร์ต 1437 มีอายุ 1 วัน',
  usage: 'รันเว็บ [pastebin_url|สถานะ|หยุด|ช่วยเหลือ] (ใช้ได้ทั้งมี / และไม่มี)',
  nashPrefix: false,
  aliases: ['runweb', 'webrun', '/รันเว็บ', '/runweb', '/webrun'],
  execute: async (api, event, args, prefix) => {
    const { threadID, messageID, senderID } = event;
    const serverKey = `${threadID}_${senderID}`;

    // ถ้าไม่มี args หรือเป็นคำสั่งช่วยเหลือ
    if (args.length === 0) {
      const helpMessage = `🌐 ระบบรันเว็บไซต์ - Premium Web Hosting
═══════════════════════════════════════════

📋 วิธีใช้งาน (ใช้ได้ทั้งมี / และไม่มี):
────────────────────────────────────────
🚀 รันเว็บ [pastebin_url] หรือ /รันเว็บ [pastebin_url]
   └ รันเว็บไซต์จาก HTML ใน Pastebin
   └ สร้าง URL สวยๆ เฉพาะตัว

📊 รันเว็บ สถานะ หรือ /รันเว็บ สถานะ
   └ ตรวจสอบสถานะและข้อมูลเว็บไซต์

📋 รันเว็บ รายการ หรือ /รันเว็บ รายการ
   └ ดูรายการเว็บไซต์ทั้งหมดที่สร้าง

🗑️ รันเว็บ ลบ [ชื่อไฟล์] หรือ /รันเว็บ ลบ [ชื่อไฟล์]
   └ หยุดเว็บไซต์เฉพาะตามชื่อไฟล์

⏹️ รันเว็บ หยุด หรือ /รันเว็บ หยุด
   └ หยุดเซิร์ฟเวอร์เว็บทั้งหมด

📝 ตัวอย่างการใช้งาน:
────────────────────────────────────────
🚀 รันเว็บ https://pastebin.com/abc123
📊 /รันเว็บ สถานะ
📋 รันเว็บ รายการ
🗑️ /รันเว็บ ลบ candy
⏹️ รันเว็บ หยุด

🎯 ตัวอย่าง URL ที่ได้:
────────────────────────────────────────
http://menu.panelaimbot.com:1437/candy.html
http://menu.panelaimbot.com:1437/star.html
http://menu.panelaimbot.com:1437/love.html

⚙️ คุณสมบัติระดับ Premium:
────────────────────────────────────────
✨ URL สวยและเฉพาะตัว
🚀 รันได้ทันที บนพอร์ต 1437
📸 ภาพตัวอย่างอัตโนมัติ HD
⏰ อายุ 24 ชั่วโมง
🔄 หยุดอัตโนมัติ
💎 รองรับ HTML, CSS, JavaScript
📁 เก็บไฟล์ในโฟลเดอร์ iove
📋 รายการเว็บไซต์และการหยุดเฉพาะ
🗑️ หยุดแยกตามชื่อไฟล์
🔧 ใช้ได้ทั้งมี / และไม่มี prefix

🤖 Bot Web System v2.1 - Premium Edition`;
      
      await api.sendMessage(helpMessage, threadID, messageID);
      return;
    }

    // ตรวจสอบสถานะ
    if (args[0] === 'สถานะ' || args[0] === 'status') {
      let statusMessage = '📊 สถานะเซิร์ฟเวอร์เว็บ\n';
      statusMessage += '═══════════════════\n\n';
      
      if (webServerManager.hasServer(serverKey)) {
        const serverInfo = webServerManager.getServerInfo(serverKey);
        
        if (serverInfo && !serverInfo.isExpired) {
          const hoursRemaining = Math.floor(serverInfo.remaining / (1000 * 60 * 60));
          const minutesRemaining = Math.floor((serverInfo.remaining % (1000 * 60 * 60)) / (1000 * 60));
          
          statusMessage += '🟢 เซิร์ฟเวอร์: กำลังทำงาน\n';
          statusMessage += `🎯 ชื่อเว็บ: ${serverInfo.websiteName || 'ไม่ระบุ'}\n`;
          statusMessage += `📁 เก็บที่: iove/\n`;
          statusMessage += `🌐 URL: ${serverInfo.url}\n`;
          statusMessage += `🕐 เริ่มต้น: ${serverInfo.startTime.toLocaleString('th-TH')}\n`;
          statusMessage += `⏰ เหลือเวลา: ${hoursRemaining} ชั่วโมง ${minutesRemaining} นาที\n\n`;
          statusMessage += `💡 ใช้คำสั่ง \`รันเว็บ หยุด\` หรือ \`/รันเว็บ หยุด\` เพื่อหยุดเซิร์ฟเวอร์`;
        } else {
          webServerManager.removeServer(serverKey);
          statusMessage += '🔴 เซิร์ฟเวอร์: หมดอายุแล้ว\n';
          statusMessage += `💡 ใช้คำสั่ง \`รันเว็บ [pastebin_url]\` หรือ \`/รันเว็บ [pastebin_url]\` เพื่อเริ่มเซิร์ฟเวอร์ใหม่`;
        }
      } else {
        statusMessage += '🔴 เซิร์ฟเวอร์: ไม่ทำงาน\n';
        statusMessage += `💡 ใช้คำสั่ง \`รันเว็บ [pastebin_url]\` หรือ \`/รันเว็บ [pastebin_url]\` เพื่อเริ่มเซิร์ฟเวอร์`;
      }

      const totalServers = webServerManager.getServerCount();
      if (totalServers > 0) {
        statusMessage += `\n\n📈 เซิร์ฟเวอร์ทั้งหมด: ${totalServers} ตัว`;
      }
      
      await api.sendMessage(statusMessage, threadID, messageID);
      return;
    }

    // ดูรายการเว็บไซต์ทั้งหมด
    if (args[0] === 'รายการ' || args[0] === 'list') {
      const allServers = webServerManager.getAllServers();
      
      if (allServers.size === 0) {
        await api.sendMessage(
          '📋 รายการเว็บไซต์\n' +
          '═══════════════════\n\n' +
          '🔍 ไม่พบเว็บไซต์ที่กำลังทำงาน\n\n' +
          `💡 ใช้คำสั่ง \`รันเว็บ [pastebin_url]\` เพื่อสร้างเว็บไซต์ใหม่`,
          threadID, messageID
        );
        return;
      }

      let listMessage = '📋 รายการเว็บไซต์ทั้งหมด\n';
      listMessage += '═══════════════════\n\n';
      
      let count = 1;
      for (const [key, serverData] of allServers.entries()) {
        const serverInfo = webServerManager.getServerInfo(key);
        if (serverInfo && !serverInfo.isExpired) {
          const hoursRemaining = Math.floor(serverInfo.remaining / (1000 * 60 * 60));
          const minutesRemaining = Math.floor((serverInfo.remaining % (1000 * 60 * 60)) / (1000 * 60));
          
          listMessage += `${count}. 🎯 ${serverInfo.websiteName}\n`;
          listMessage += `   📁 เก็บที่: iove/\n`;
          listMessage += `   🌐 ${serverInfo.url}\n`;
          listMessage += `   ⏰ เหลือ: ${hoursRemaining}ชม ${minutesRemaining}นาที\n\n`;
          count++;
        }
      }
      
      if (count === 1) {
        listMessage += '🔍 ไม่พบเว็บไซต์ที่กำลังทำงาน\n';
      } else {
        listMessage += `📊 รวม: ${count - 1} เว็บไซต์\n\n`;
        listMessage += `💡 หยุดเว็บไซต์: \`รันเว็บ ลบ [ชื่อไฟล์]\`\n`;
        listMessage += `🔄 หยุดทั้งหมด: \`รันเว็บ หยุด\``;
      }
      
      await api.sendMessage(listMessage, threadID, messageID);
      return;
    }

    // หยุดเว็บไซต์เฉพาะ
    if (args[0] === 'ลบ' || args[0] === 'delete') {
      if (args.length < 2) {
        await api.sendMessage(
          '❌ กรุณาระบุชื่อไฟล์ที่ต้องการหยุด\n\n' +
          '📝 ตัวอย่าง: รันเว็บ ลบ candy\n' +
          '📋 ดูรายการ: รันเว็บ รายการ',
          threadID, messageID
        );
        return;
      }

      const targetFileName = args[1];
      const allServers = webServerManager.getAllServers();
      let foundServer = null;
      let foundKey = null;

      // ค้นหาเว็บไซต์ที่มีชื่อตรงกัน
      for (const [key, serverData] of allServers.entries()) {
        if (serverData.websiteName === targetFileName) {
          foundServer = serverData;
          foundKey = key;
          break;
        }
      }

      if (!foundServer) {
        await api.sendMessage(
          `❌ ไม่พบเว็บไซต์ชื่อ "${targetFileName}"\n\n` +
          '📋 ดูรายการ: รันเว็บ รายการ\n' +
          '💡 ตรวจสอบชื่อไฟล์ให้ถูกต้อง',
          threadID, messageID
        );
        return;
      }

      // หยุดเว็บไซต์เฉพาะ
      const success = webServerManager.removeServer(foundKey);
      if (success) {
        // Clean up HTML file when manually stopped
        if (foundServer.htmlFilePath && fs.existsSync(foundServer.htmlFilePath)) {
          fs.unlinkSync(foundServer.htmlFilePath);
        }
        
        await api.sendMessage(
          `✅ หยุดเว็บไซต์สำเร็จ!\n\n` +
          `🗑️ ไฟล์: ${targetFileName}\n` +
          `📁 เก็บที่: iove/\n` +
          `🌐 URL: ${foundServer.url}\n` +
          `🗑️ ไฟล์ HTML ถูกลบแล้ว\n\n` +
          `📋 ดูรายการที่เหลือ: รันเว็บ รายการ`,
          threadID, messageID
        );
      } else {
        await api.sendMessage(
          `❌ ไม่สามารถหยุดเว็บไซต์ "${targetFileName}" ได้\n` +
          'กรุณาลองใหม่อีกครั้ง',
          threadID, messageID
        );
      }
      return;
    }

    // หยุดเซิร์ฟเวอร์ทั้งหมด
    if (args[0] === 'หยุด' || args[0] === 'stop') {
      const allServers = webServerManager.getAllServers();
      let stoppedCount = 0;

      // หยุดเซิร์ฟเวอร์ทั้งหมดก่อน
      for (const [key, serverData] of allServers.entries()) {
        // Clean up HTML files
        if (serverData.htmlFilePath && fs.existsSync(serverData.htmlFilePath)) {
          fs.unlinkSync(serverData.htmlFilePath);
        }
        
        const success = webServerManager.removeServer(key);
        if (success) stoppedCount++;
      }

      if (stoppedCount > 0) {
        await api.sendMessage(
          `✅ หยุดเซิร์ฟเวอร์เว็บสำเร็จ!\n\n` +
          `🔴 เซิร์ฟเวอร์ที่หยุด: ${stoppedCount} ตัว\n` +
          `🌐 พอร์ต 1437: ว่าง\n` +
          `🗑️ ไฟล์ HTML ทั้งหมดถูกลบแล้ว\n\n` +
          `💡 ใช้คำสั่ง \`รันเว็บ [pastebin_url]\` เพื่อเริ่มเซิร์ฟเวอร์ใหม่`,
          threadID, messageID
        );
        return;
      }

      await api.sendMessage('🔄 กำลังค้นหาและหยุดเซิร์ฟเวอร์...', threadID, messageID);
      
      exec('lsof -ti:1437', (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
          api.sendMessage(
            '💡 ไม่พบเซิร์ฟเวอร์ที่ทำงานบนพอร์ต 1437\n' +
            'เซิร์ฟเวอร์อาจหยุดทำงานแล้ว',
            threadID, messageID
          );
          return;
        }

        const pids = stdout.trim().split('\n');
        let killedCount = 0;
        const totalPids = pids.filter(p => p).length;

        pids.forEach(pid => {
          if (pid) {
            exec(`kill -9 ${pid}`, (killError) => {
              if (!killError) killedCount++;
              
              if (killedCount > 0 && killedCount === totalPids) {
                api.sendMessage(
                  '✅ หยุดเซิร์ฟเวอร์เว็บสำเร็จ!\n\n' +
                  '🔴 เซิร์ฟเวอร์: หยุดทำงาน\n' +
                  '🌐 พอร์ต 1437: ว่าง',
                  threadID
                );
              }
            });
          }
        });
      });
      return;
    }

    // รันเว็บไซต์ใหม่
    const pastebinUrl = args[0];
    
    // Validate Pastebin URL
    if (!pastebinUrl.includes('pastebin.com/')) {
      await api.sendMessage(
        '❌ กรุณาใช้ลิงก์ Pastebin เท่านั้น\n\n' +
        '📝 ตัวอย่าง: https://pastebin.com/abc123\n' +
        `💡 ดูวิธีใช้: รันเว็บ (ไม่มี arguments)`,
        threadID, messageID
      );
      return;
    }

    await api.sendMessage('🔄 กำลังดาวน์โหลดและประมวลผล HTML...', threadID, messageID);

    try {
      // Extract Pastebin ID and create raw URL
      const pastebinId = pastebinUrl.split('/').pop().split('?')[0];
      const rawUrl = `https://pastebin.com/raw/${pastebinId}`;
      
      // Generate unique website name with longer cute names (7+ characters)
      const websiteNames = [
        'sweetlove', 'honeybee', 'sugarplum', 'creamcake', 'berrysweet', 'peachbaby', 'cherrybomb', 'bubblegum',
        'fluffycat', 'starlight', 'moonbeam', 'sunshine', 'flower12', 'rosepetal', 'lilywhite', 'daisychain',
        'cookiemonster', 'cakepop', 'sweetie', 'cuteness', 'lovebug', 'joyfully', 'happiness', 'smiley',
        'magical', 'dreamer', 'wishful', 'heartbeat', 'kissable', 'hugable', 'bunnylove', 'kittypaw',
        'angelwings', 'rainbow', 'butterfly', 'unicorn', 'princess', 'fairytale', 'sparkles', 'glitter',
        'cupcake', 'muffin', 'brownie', 'chocolate', 'vanilla', 'strawberry', 'blueberry', 'raspberry',
        'sunflower', 'lavender', 'jasmine', 'orchid', 'magnolia', 'gardenia', 'petunia', 'begonia',
        'beautiful', 'gorgeous', 'amazing', 'wonderful', 'fantastic', 'marvelous', 'stunning', 'brilliant'
      ];
      
      const categories = ['premium', 'deluxe', 'studio', 'gallery', 'palace', 'mansion', 'castle', 'paradise'];
      const randomName = websiteNames[Math.floor(Math.random() * websiteNames.length)];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      
      const websiteName = `${randomName}`;
      const websitePath = `/${websiteName}.html`;
      
      // Create HTML file directory in iove folder
      const htmlDir = path.join(__dirname, '../../iove');
      const htmlFilePath = path.join(htmlDir, `${websiteName}.html`);
      
      // Fetch HTML content
      const response = await axios.get(rawUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const htmlContent = response.data;

      // Validate if it's HTML content
      if (!htmlContent.toLowerCase().includes('<html') && !htmlContent.toLowerCase().includes('<!doctype')) {
        await api.sendMessage(
          '⚠️ เนื้อหาที่ดาวน์โหลดไม่ใช่ HTML\n' +
          'กรุณาตรวจสอบว่าลิงก์ Pastebin มี HTML code',
          threadID, messageID
        );
        return;
      }

      // Create directory if it doesn't exist and save HTML file
      if (!fs.existsSync(htmlDir)) {
        fs.mkdirSync(htmlDir, { recursive: true });
      }
      
      // Save HTML content to file
      fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');

      // Check if server is already running for this thread
      if (webServerManager.hasServer(serverKey)) {
        webServerManager.removeServer(serverKey);
        await api.sendMessage('🔄 หยุดเว็บไซต์เก่าและเริ่มใหม่...', threadID);
      }

      // Use global server instead of creating new one
      if (!globalServer || !globalApp) {
        await api.sendMessage(
          '❌ เซิร์ฟเวอร์หลักไม่ทำงาน กำลังเริ่มเซิร์ฟเวอร์ใหม่...',
          threadID, messageID
        );
        globalServer = initializeStaticServer();
        if (!globalServer) {
          await api.sendMessage(
            '❌ ไม่สามารถเริ่มเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง',
            threadID, messageID
          );
          return;
        }
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Add dynamic route for this website to existing app
      globalApp.get(websitePath, (req, res) => {
        res.sendFile(htmlFilePath);
      });

      const baseUrl = `http://menu.panelaimbot.com:1437`;
      const fullUrl = `${baseUrl}${websitePath}`;
      
      // Take screenshot for preview first
      let screenshotSuccess = false;
      try {
        await takeScreenshot(fullUrl, threadID, messageID, api, websiteName, randomCategory, pastebinUrl);
        screenshotSuccess = true;
      } catch (screenshotError) {
        console.error('Screenshot error:', screenshotError);
        screenshotSuccess = false;
      }

      // Send success message (only once)
      if (!screenshotSuccess) {
        await api.sendMessage(
          `✅ เว็บไซต์รันสำเร็จ!\n\n` +
          `🌐 URL: ${fullUrl}\n` +
          `🎯 ชื่อเว็บ: ${websiteName}\n` +
          `📁 เก็บที่: iove/\n` +
          `⏰ อายุ: 1 วัน (24 ชั่วโมง)\n` +
          `📝 จาก: ${pastebinUrl}\n\n` +
          `📸 ไม่สามารถสร้างภาพตัวอย่างได้ แต่เว็บไซต์ทำงานปกติ`,
          threadID, messageID
        );
      }

      // Set 24-hour timeout
      const timeout = setTimeout(() => {
        webServerManager.removeServer(serverKey);
        
        // Clean up HTML file when expired
        if (fs.existsSync(htmlFilePath)) {
          fs.unlinkSync(htmlFilePath);
        }
        
        api.sendMessage(
          `⏰ เว็บไซต์ "${websiteName}" หมดอายุแล้ว (24 ชั่วโมง)\n` +
          `🌐 URL: ${fullUrl}\n` +
          `🗑️ ไฟล์ HTML ถูกลบแล้ว`,
          threadID
        );
      }, 24 * 60 * 60 * 1000); // 24 hours

      // Store server info
      webServerManager.addServer(serverKey, {
        server: globalServer,
        timeout: timeout,
        url: fullUrl,
        websiteName: websiteName,
        startTime: new Date(),
        htmlFilePath: htmlFilePath
      });

    } catch (error) {
      console.error('Error in รันเว็บ command:', error);
      
      let errorMessage = '❌ เกิดข้อผิดพลาด: ';
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        errorMessage += 'ไม่สามารถเชื่อมต่อกับ Pastebin ได้';
      } else if (error.response && error.response.status === 404) {
        errorMessage += 'ไม่พบลิงก์ Pastebin ที่ระบุ';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage += 'หมดเวลาการเชื่อมต่อ';
      } else {
        errorMessage += error.message;
      }
      
      await api.sendMessage(errorMessage, threadID, messageID);
    }
  }
};

async function takeScreenshot(url, threadID, messageID, api, websiteName, category, pastebinUrl) {
  let browser;
  try {
    // Launch Puppeteer without a specific executablePath to allow it to find the browser automatically.
    // This is more portable across different environments.
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Common fix for issues in containerized environments
        '--disable-gpu' // Often needed in server environments
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    
    // Wait for page to load
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });

    // Take screenshot
    const screenshotPath = path.join(__dirname, '../../cache', `${websiteName}_preview_${Date.now()}.png`);
    
    // Ensure cache directory exists
    const cacheDir = path.dirname(screenshotPath);
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    await page.screenshot({ 
      path: screenshotPath,
      fullPage: false
    });

    // Send success message with screenshot
    await api.sendMessage({
      body: `✅ เว็บไซต์รันสำเร็จ!\n\n` +
            `🌐 URL: ${url}\n` +
            `🎯 ชื่อเว็บ: ${websiteName}\n` +
            `📁 เก็บที่: iove/\n` +
            `⏰ อายุ: 1 วัน (24 ชั่วโมง)\n` +
            `📝 จาก: ${pastebinUrl}\n\n` +
            `📸 ภาพตัวอย่างเว็บไซต์:`,
      attachment: fs.createReadStream(screenshotPath)
    }, threadID);

    // Clean up screenshot file after sending
    setTimeout(() => {
      if (fs.existsSync(screenshotPath)) {
        fs.unlinkSync(screenshotPath);
      }
    }, 5000);

  } catch (error) {
    console.error('Screenshot error:', error);
    throw error; // Re-throw the error to be caught by the main execute function
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
