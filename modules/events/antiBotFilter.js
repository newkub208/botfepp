/**
 * @name antiBotFilter
 * @description ระบบตรวจจับและเตะบอทอัตโนมัติที่ส่งข้อความเร็วเกินปกติ
 * @version 1.0.0
 * @author Auto Generated System
 */

const fs = require('fs');
const path = require('path');

// ไฟล์เก็บการตั้งค่า Anti-Bot
const CONFIG_FILE = path.join(__dirname, '../commands/antiBotConfig.json');

// ข้อมูลการติดตามผู้ใช้
let userMessageTracker = new Map();
let userWarnings = new Map();
let lastCleanup = Date.now(); // ตัวแปรเก็บเวลาล้างข้อมูลครั้งล่าสุด

// ฟังก์ชันล้างข้อมูลเก่า (ทำงานทุก 5 นาที)
function cleanupOldData() {
    const now = Date.now();
    if (now - lastCleanup < 300000) return; // ล้างทุก 5 นาที
    
    lastCleanup = now;
    
    // ล้างข้อมูล tracking ที่เก่าเกิน 10 นาที
    for (const [userID, messages] of userMessageTracker.entries()) {
        const recentMessages = messages.filter(timestamp => now - timestamp < 600000);
        if (recentMessages.length === 0) {
            userMessageTracker.delete(userID);
        } else {
            userMessageTracker.set(userID, recentMessages);
        }
    }
    
    // ล้างการเตือนที่ไม่มีข้อความล่าสุด
    for (const userID of userWarnings.keys()) {
        if (!userMessageTracker.has(userID)) {
            userWarnings.delete(userID);
        }
    }
}

// โหลดการตั้งค่า
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('[Anti-Bot Config] Error loading config:', error);
    }
    return {
        enabled: true,
        maxMessagesPerMinute: 10, // ข้อความสูงสุดต่อนาที
        warningCount: 3, // จำนวนการเตือนก่อนเตะ
        timeWindow: 60000, // หน้าต่างเวลา (มิลลิวินาที)
        ignoredUIDs: [], // UID ที่ไม่ต้องการตรวจสอบ
        adminUID: "61555184860915",
        threads: {} // การตั้งค่าเฉพาะกลุ่ม
    };
}

// บันทึกการตั้งค่า
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('[Anti-Bot Config] Error saving config:', error);
        return false;
    }
}

// ตรวจสอบว่าเป็นการส่งข้อความเร็วเกินปกติหรือไม่
function isSuspiciousActivity(senderID, config) {
    const now = Date.now();
    const timeWindow = config.timeWindow || 60000;
    const maxMessages = config.maxMessagesPerMinute || 10;

    if (!userMessageTracker.has(senderID)) {
        userMessageTracker.set(senderID, []);
    }

    const userMessages = userMessageTracker.get(senderID);
    
    // ลบข้อความที่เก่าเกินหน้าต่างเวลา
    const recentMessages = userMessages.filter(timestamp => now - timestamp < timeWindow);
    
    // เพิ่มข้อความใหม่
    recentMessages.push(now);
    
    // อัพเดทข้อมูล
    userMessageTracker.set(senderID, recentMessages);

    // ตรวจสอบว่าเกินขด limit หรือไม่
    return recentMessages.length > maxMessages;
}

// เพิ่มการเตือน
function addWarning(senderID) {
    const currentWarnings = userWarnings.get(senderID) || 0;
    const newWarnings = currentWarnings + 1;
    userWarnings.set(senderID, newWarnings);
    return newWarnings;
}

// รีเซ็ตการเตือน
function resetWarnings(senderID) {
    userWarnings.delete(senderID);
}

// ฟังก์ชันเตะผู้ใช้
async function kickUser(api, threadID, userID, reason) {
    try {
        await api.removeUserFromGroup(userID, threadID);
        console.log(`[Anti-Bot] Kicked user ${userID} from thread ${threadID}. Reason: ${reason}`);
        return true;
    } catch (error) {
        console.error(`[Anti-Bot] Failed to kick user ${userID}:`, error);
        return false;
    }
}

module.exports = {
    name: "antiBotFilter",
    
    async handleEvent(api, event) {
        // ตรวจสอบเฉพาะ event type message ที่มี body เท่านั้น
        if (event.type !== "message" || !event.body) return;
        
        const { threadID, senderID, messageID } = event;
        const config = loadConfig();

        // ตรวจสอบว่าระบบเปิดอยู่หรือไม่ (ไม่แสดงข้อความ debug)
        if (!config.enabled) return;

        // ล้างข้อมูลเก่าเป็นระยะ
        cleanupOldData();

        // ตรวจสอบว่าเป็น admin หรือ UID ที่ไม่ต้องการตรวจสอบ
        if (senderID === config.adminUID || config.ignoredUIDs.includes(senderID)) {
            return;
        }

        // ตรวจสอบการตั้งค่าเฉพาะกลุ่ม
        const threadConfig = config.threads[threadID];
        if (threadConfig && !threadConfig.enabled) return;

        try {
            // ตรวจสอบกิจกรรมที่น่าสงสัย
            if (isSuspiciousActivity(senderID, config)) {
                const warningCount = addWarning(senderID);
                const maxWarnings = config.warningCount || 3;

                if (warningCount >= maxWarnings) {
                    // เตะผู้ใช้หลังจากเตือนครบจำนวน
                    const kicked = await kickUser(api, threadID, senderID, "ตรวจพบกิจกรรมบอทอัตโนมัติ");
                    
                    if (kicked) {
                        // ลบข้อมูลผู้ใช้ออกจากระบบติดตาม
                        userMessageTracker.delete(senderID);
                        resetWarnings(senderID);
                        
                        // ส่งข้อความแจ้งเตือน
                        const kickMessage = `🚫 ตรวจพบกิจกรรมบอทอัตโนมัติ!\n\n` +
                                          `👤 ผู้ใช้ถูกเตะออกจากกลุ่ม\n` +
                                          `⚠️ สาเหตุ: ส่งข้อความเร็วเกินปกติ (${config.maxMessagesPerMinute} ข้อความ/นาที)\n` +
                                          `📊 การเตือน: ${warningCount}/${maxWarnings} ครั้ง\n` +
                                          `🤖 ระบบ Anti-Bot ทำงานอัตโนมัติ`;
                        
                        api.sendMessage(kickMessage, threadID);
                        console.log(`[Anti-Bot] Successfully kicked user ${senderID} from thread ${threadID}`);
                    } else {
                        api.sendMessage("❌ ไม่สามารถเตะผู้ใช้ได้ (อาจไม่มีสิทธิ์หรือผู้ใช้เป็นแอดมิน)", threadID);
                    }
                } else {
                    // ส่งข้อความเตือน
                    const warningMessage = `⚠️ คำเตือนระบบ Anti-Bot\n\n` +
                                         `👤 การส่งข้อความเร็วเกินปกติตรวจพบ!\n` +
                                         `📊 การเตือน: ${warningCount}/${maxWarnings} ครั้ง\n` +
                                         `🚨 หากถูกเตือนครบ ${maxWarnings} ครั้ง จะถูกเตะออกจากกลุ่มอัตโนมัติ\n` +
                                         `💡 กรุณาส่งข้อความช้าลงเพื่อหลีกเลี่ยงการถูกตรวจจับ`;
                    
                    api.sendMessage(warningMessage, threadID, messageID);
                    console.log(`[Anti-Bot] Warning ${warningCount}/${maxWarnings} sent to user ${senderID}`);
                }
            }
        } catch (error) {
            console.error('[Anti-Bot Filter Error]:', error);
        }
    }
};
