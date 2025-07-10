const axios = require('axios');
const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const webServerManager = require('../../utils/webServerManager');

module.exports = {
  name: 'รันเว็บ',
  description: 'รันเว็บไซต์จาก HTML ที่วางใน Pastebin บนพอร์ต 6666 มีอายุ 1 วัน',
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
🗑️ /รันเว็บ ลบ cosmic1234
⏹️ รันเว็บ หยุด

🎯 ตัวอย่าง URL ที่ได้:
────────────────────────────────────────
http://menu.panelaimbot.com:6666/vip/cosmic1234.html
http://menu.panelaimbot.com:6666/premium/stellar5678.html
http://menu.panelaimbot.com:6666/elite/quantum9012.html

⚙️ คุณสมบัติระดับ Premium:
────────────────────────────────────────
✨ URL สวยและเฉพาะตัว
🚀 รันได้ทันที บนพอร์ต 6666
📸 ภาพตัวอย่างอัตโนมัติ HD
⏰ อายุ 24 ชั่วโมง
🔄 หยุดอัตโนมัติ
💎 รองรับ HTML, CSS, JavaScript
🌟 หมวดหมู่ VIP, Premium, Elite
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
          statusMessage += `� ชื่อเว็บ: ${serverInfo.websiteName || 'ไม่ระบุ'}\n`;
          statusMessage += `📁 หมวด: ${(serverInfo.category || 'general').toUpperCase()}\n`;
          statusMessage += `�🌐 URL: ${serverInfo.url}\n`;
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
          listMessage += `   📁 หมวด: ${(serverInfo.category || 'general').toUpperCase()}\n`;
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
          '📝 ตัวอย่าง: รันเว็บ ลบ cosmic1234\n' +
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
        await api.sendMessage(
          `✅ หยุดเว็บไซต์สำเร็จ!\n\n` +
          `🗑️ ไฟล์: ${targetFileName}\n` +
          `📁 หมวด: ${(foundServer.category || 'general').toUpperCase()}\n` +
          `🌐 URL: ${foundServer.url}\n\n` +
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
        const success = webServerManager.removeServer(key);
        if (success) stoppedCount++;
      }

      if (stoppedCount > 0) {
        await api.sendMessage(
          `✅ หยุดเซิร์ฟเวอร์เว็บสำเร็จ!\n\n` +
          `🔴 เซิร์ฟเวอร์ที่หยุด: ${stoppedCount} ตัว\n` +
          `🌐 พอร์ต 6666: ว่าง\n\n` +
          `💡 ใช้คำสั่ง \`รันเว็บ [pastebin_url]\` เพื่อเริ่มเซิร์ฟเวอร์ใหม่`,
          threadID, messageID
        );
        return;
      }

      await api.sendMessage('🔄 กำลังค้นหาและหยุดเซิร์ฟเวอร์...', threadID, messageID);
      
      exec('lsof -ti:6666', (error, stdout, stderr) => {
        if (error || !stdout.trim()) {
          api.sendMessage(
            '💡 ไม่พบเซิร์ฟเวอร์ที่ทำงานบนพอร์ต 6666\n' +
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
                  '🌐 พอร์ต 6666: ว่าง',
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
      
      // Generate unique website name
      const websiteNames = [
        'cosmic', 'stellar', 'quantum', 'nexus', 'aurora', 'zenith', 'phoenix', 'vortex',
        'eclipse', 'infinity', 'prism', 'matrix', 'cyber', 'neon', 'plasma', 'crystal',
        'diamond', 'emerald', 'sapphire', 'ruby', 'pearl', 'gold', 'silver', 'platinum',
        'thunder', 'lightning', 'storm', 'blaze', 'frost', 'shadow', 'light', 'mystic',
        'legend', 'epic', 'royal', 'supreme', 'ultra', 'mega', 'hyper', 'super',
        'alpha', 'beta', 'gamma', 'delta', 'omega', 'sigma', 'theta', 'lambda'
      ];
      
      const categories = ['vip', 'premium', 'pro', 'elite', 'deluxe', 'studio', 'lab', 'space'];
      const randomName = websiteNames[Math.floor(Math.random() * websiteNames.length)];
      const randomCategory = categories[Math.floor(Math.random() * categories.length)];
      const timestamp = Date.now().toString().slice(-4);
      
      const websiteName = `${randomName}${timestamp}`;
      const websitePath = `/${randomCategory}/${websiteName}.html`;
      
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

      // Check if server is already running for this thread
      if (webServerManager.hasServer(serverKey)) {
        webServerManager.removeServer(serverKey);
        await api.sendMessage('🔄 หยุดเซิร์ฟเวอร์เก่าและเริ่มใหม่...', threadID);
      }

      // Create Express app
      const app = express();
      const port = 6666;

      // Serve the HTML content on custom path
      app.get(websitePath, (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(htmlContent);
      });

      // Redirect root to custom path
      app.get('/', (req, res) => {
        res.redirect(websitePath);
      });

      // Serve static files if needed
      app.use('/static', express.static(path.join(__dirname, '../../public')));

      // Start server
      const server = app.listen(port, '0.0.0.0', async () => {
        const baseUrl = `http://menu.panelaimbot.com:${port}`;
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
            `📁 หมวด: ${randomCategory.toUpperCase()}\n` +
            `⏰ อายุ: 1 วัน (24 ชั่วโมง)\n` +
            `📝 จาก: ${pastebinUrl}\n\n` +
            `📸 ไม่สามารถสร้างภาพตัวอย่างได้ แต่เว็บไซต์ทำงานปกติ`,
            threadID, messageID
          );
        }

        // Set 24-hour timeout
        const timeout = setTimeout(() => {
          webServerManager.removeServer(serverKey);
          api.sendMessage(
            `⏰ เว็บไซต์ "${websiteName}" หมดอายุแล้ว (24 ชั่วโมง)\n` +
            `🌐 URL: ${fullUrl}`,
            threadID
          );
        }, 24 * 60 * 60 * 1000); // 24 hours

        // Store server info
        webServerManager.addServer(serverKey, {
          server: server,
          timeout: timeout,
          url: fullUrl,
          websiteName: websiteName,
          category: randomCategory,
          startTime: new Date()
        });
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          api.sendMessage(
            `❌ พอร์ต ${port} ถูกใช้งานอยู่\n` +
            `🔄 ใช้คำสั่ง \`รันเว็บ หยุด\` หรือ \`/รันเว็บ หยุด\` แล้วลองใหม่`,
            threadID, messageID
          );
        } else {
          api.sendMessage(
            `❌ เกิดข้อผิดพลาดในการรันเซิร์ฟเวอร์: ${error.message}`,
            threadID, messageID
          );
        }
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
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/usr/bin/chromium-browser',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
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
            `📁 หมวด: ${category.toUpperCase()}\n` +
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
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
