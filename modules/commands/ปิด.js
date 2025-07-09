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

// --- ฟังก์ชันสำหรับบันทึกสถานะบอท ---
function saveBotState(state) {
    try {
        fs.writeFileSync(BOT_STATE_FILE_PATH, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('Error saving bot state:', error);
    }
}

// --- ฟังก์ชันตรวจสอบสิทธิ์ ---
function hasPermission(senderID) {
    const admins = loadAdmins();
    return senderID === SUPER_ADMIN_ID || admins.includes(senderID);
}

module.exports = {
    name: "ปิด",
    description: "ปิดการทำงานของบอทในกลุ่มนี้ (สำหรับแอดมินเท่านั้น)",
    version: "1.0.0",
    aliases: ["off"],
    nashPrefix: false,
    cooldowns: 2,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;

        // --- ตรวจสอบสิทธิ์ผู้ใช้งาน ---
        if (!hasPermission(senderID)) {
            return api.sendMessage("❌ คำสั่งนี้สำหรับแอดมินเท่านั้น", threadID, messageID);
        }

        try {
            const botState = loadBotState();

            // ตรวจสอบสถานะปัจจุบันของกลุ่มนี้
            const currentlyEnabled = isBotEnabledInThread(threadID);

            if (!currentlyEnabled) {
                return api.sendMessage("ℹ️ บอทปิดใช้งานในกลุ่มนี้อยู่แล้ว", threadID, messageID);
            }

            // ปิดบอทในกลุ่มนี้
            if (!botState.threads[threadID]) {
                botState.threads[threadID] = {};
            }
            
            botState.threads[threadID].enabled = false;
            botState.threads[threadID].disabledAt = new Date().toISOString();
            botState.threads[threadID].disabledBy = senderID;
            
            saveBotState(botState);

            // ดึงข้อมูลกลุ่มเพื่อแสดงชื่อ
            let groupName = "กลุ่มนี้";
            try {
                const threadInfo = await api.getThreadInfo(threadID);
                groupName = threadInfo.threadName || "กลุ่มนี้";
            } catch (e) {
                // ใช้ค่าเริ่มต้นถ้าดึงข้อมูลไม่ได้
            }

            api.sendMessage(
                `🔴 ปิดการทำงานของบอทในกลุ่ม "${groupName}" เรียบร้อยแล้ว\n\n` +
                `⚠️ ตั้งแต่ตอนนี้ในกลุ่มนี้:\n` +
                `• บอทจะตอบเฉพาะแอดมินเท่านั้น\n` +
                `• ผู้ใช้ทั่วไปไม่สามารถใช้คำสั่งได้\n` +
                `• คำสั่งทั้งหมดใช้งานได้เฉพาะแอดมิน\n\n` +
                `� วิธีเปิดใหม่: พิมพ์ "${prefix}เปิด" หรือ "${prefix}on"\n` +
                `📅 ปิดเมื่อ: ${new Date().toLocaleString('th-TH')}`,
                threadID,
                messageID
            );

        } catch (error) {
            console.error('Bot disable error:', error);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการปิดบอท\n` +
                `🔧 Error: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
