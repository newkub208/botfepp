const fs = require('fs');
const path = require('path');

// --- กำหนดค่าคงที่ ---
const SUPER_ADMIN_ID = '61555184860915'; // ไอดีของผู้ใช้ที่มีสิทธิ์สูงสุด
const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json'); // ที่อยู่ของไฟล์เก็บรายชื่อแอดมิน
const BOT_STATE_FILE_PATH = path.join(__dirname, '../../bot_state.json'); // ที่อยู่ของไฟล์เก็บสถานะบอท

// --- ฟังก์ชันสำหรับโหลดรายชื่อแอดมิน ---
function loadAdmins() {
    try {
        if (fs.existsSync(ADMIN_FILE_PATH)) {
            const data = fs.readFileSync(ADMIN_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading admin list:', error);
    }
    return [];
}

// --- ฟังก์ชันสำหรับโหลดสถานะบอท ---
function loadBotState() {
    try {
        if (fs.existsSync(BOT_STATE_FILE_PATH)) {
            const data = fs.readFileSync(BOT_STATE_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading bot state:', error);
    }
    return { 
        globalEnabled: true,
        threads: {}
    }; // ค่าเริ่มต้น: เปิดใช้งานทั่วไป
}

// --- ฟังก์ชันตรวจสอบสถานะบอทในกลุ่ม ---
function isBotEnabledInThread(threadID) {
    const botState = loadBotState();
    
    // ถ้าปิดทั่วไป ให้ปิดทุกกลุ่ม
    if (!botState.globalEnabled) {
        return false;
    }
    
    // ตรวจสอบสถานะเฉพาะกลุ่ม
    if (botState.threads[threadID] && botState.threads[threadID].hasOwnProperty('enabled')) {
        return botState.threads[threadID].enabled;
    }
    
    // ค่าเริ่มต้น: เปิดใช้งาน
    return true;
}

// --- ฟังก์ชันตรวจสอบสิทธิ์ ---
function hasPermission(senderID) {
    const admins = loadAdmins();
    return senderID === SUPER_ADMIN_ID || admins.includes(senderID);
}

module.exports = {
    name: "สถานะบอท",
    description: "ตรวจสอบสถานะการทำงานของบอท",
    version: "1.0.0",
    aliases: ["status", "สถานะ"],
    nashPrefix: false,
    cooldowns: 2,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;

        try {
            const botState = loadBotState();
            const currentlyEnabled = isBotEnabledInThread(threadID);

            // ดึงข้อมูลกลุ่มเพื่อแสดงชื่อ
            let groupName = "กลุ่มนี้";
            try {
                const threadInfo = await api.getThreadInfo(threadID);
                groupName = threadInfo.threadName || "กลุ่มนี้";
            } catch (e) {
                // ใช้ค่าเริ่มต้นถ้าดึงข้อมูลไม่ได้
            }

            let statusMessage = `🤖 สถานะบอท\n\n`;
            statusMessage += `📍 กลุ่ม: ${groupName}\n`;
            statusMessage += `🌐 สถานะทั่วไป: ${botState.globalEnabled ? "🟢 เปิด" : "🔴 ปิด"}\n`;
            statusMessage += `🎯 สถานะในกลุ่มนี้: ${currentlyEnabled ? "🟢 เปิด" : "🔴 ปิด"}\n\n`;

            if (currentlyEnabled) {
                statusMessage += `✅ บอททำงานปกติในกลุ่มนี้\n`;
                statusMessage += `• ตอบทุกคนได้\n`;
                statusMessage += `• คำสั่งทั้งหมดใช้ได้\n`;
                statusMessage += `• ระบบทั้งหมดทำงานปกติ\n\n`;
                statusMessage += `🔧 ปิดบอท: ${prefix}ปิด`;
            } else {
                statusMessage += `⚠️ บอทปิดใช้งานในกลุ่มนี้\n`;
                statusMessage += `• ตอบเฉพาะแอดมิน\n`;
                statusMessage += `• คำสั่งใช้ได้เฉพาะแอดมิน\n`;
                statusMessage += `• ผู้ใช้ทั่วไปไม่สามารถใช้คำสั่งได้\n\n`;
                statusMessage += `🔧 เปิดบอท: ${prefix}เปิด`;
            }

            // แสดงข้อมูลเพิ่มเติมสำหรับแอดมิน
            if (hasPermission(senderID)) {
                statusMessage += `\n\n� ข้อมูลสำหรับแอดมิน:`;
                
                // ข้อมูลสถานะในกลุ่มนี้
                if (botState.threads[threadID]) {
                    const threadData = botState.threads[threadID];
                    if (threadData.hasOwnProperty('enabled')) {
                        statusMessage += `\n� ประวัติกลุ่มนี้:`;
                        
                        if (threadData.enabled) {
                            if (threadData.enabledAt) {
                                statusMessage += `\n🟢 เปิดล่าสุด: ${new Date(threadData.enabledAt).toLocaleString('th-TH')}`;
                            }
                            if (threadData.enabledBy) {
                                statusMessage += `\n👤 เปิดโดย: ${threadData.enabledBy}`;
                            }
                        } else {
                            if (threadData.disabledAt) {
                                statusMessage += `\n� ปิดล่าสุด: ${new Date(threadData.disabledAt).toLocaleString('th-TH')}`;
                            }
                            if (threadData.disabledBy) {
                                statusMessage += `\n👤 ปิดโดย: ${threadData.disabledBy}`;
                            }
                        }
                    }
                }

                // จำนวนกลุ่มที่มีการตั้งค่า
                const configuredThreads = Object.keys(botState.threads).length;
                statusMessage += `\n📈 กลุ่มที่มีการตั้งค่า: ${configuredThreads} กลุ่ม`;
            }

            api.sendMessage(statusMessage, threadID, messageID);

        } catch (error) {
            console.error('Bot status error:', error);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการตรวจสอบสถานะ\n` +
                `🔧 Error: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
