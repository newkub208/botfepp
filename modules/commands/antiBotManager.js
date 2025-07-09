/**
 * @name antiBotManager
 * @description จัดการระบบตรวจจับและเตะบอทอัตโนมัติ (เฉพาะแอดมิน)
 * @version 1.0.0
 * @author Auto Generated System
 */

const fs = require('fs');
const path = require('path');

// ไฟล์เก็บการตั้งค่า Anti-Bot
const CONFIG_FILE = path.join(__dirname, 'antiBotConfig.json');

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
        maxMessagesPerMinute: 10,
        warningCount: 3,
        timeWindow: 60000,
        ignoredUIDs: [],
        adminUID: "61555184860915",
        threads: {}
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

module.exports = {
    name: "antiBotManager",
    description: "จัดการระบบตรวจจับและเตะบอทอัตโนมัติ (เฉพาะแอดมิน)",
    version: "1.0.0",
    aliases: ["abm", "antibot"],
    nashPrefix: false,
    cooldowns: 5,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;
        const action = args[0]?.toLowerCase();
        const config = loadConfig();

        // ตรวจสอบสิทธิ์แอดมิน
        const adminUID = global.config?.adminUID || config.adminUID;
        if (senderID !== adminUID) {
            return api.sendMessage("❌ คำสั่งนี้ใช้ได้เฉพาะแอดมินเท่านั้น", threadID, messageID);
        }

        try {
            switch (action) {
                case 'on':
                case 'เปิด':
                    config.enabled = true;
                    if (saveConfig(config)) {
                        api.sendMessage("✅ เปิดระบบ Anti-Bot แล้ว", threadID, messageID);
                    } else {
                        api.sendMessage("❌ เกิดข้อผิดพลาดในการเปิดระบบ", threadID, messageID);
                    }
                    break;

                case 'off':
                case 'ปิด':
                    config.enabled = false;
                    if (saveConfig(config)) {
                        api.sendMessage("✅ ปิดระบบ Anti-Bot แล้ว", threadID, messageID);
                    } else {
                        api.sendMessage("❌ เกิดข้อผิดพลาดในการปิดระบบ", threadID, messageID);
                    }
                    break;

                case 'setlimit':
                case 'ตั้งขีดจำกัด':
                    const newLimit = parseInt(args[1]);
                    if (!newLimit || newLimit <= 0) {
                        api.sendMessage("❌ กรุณาระบุจำนวนข้อความสูงสุดต่อนาที (ตัวเลขบวก)\nตัวอย่าง: antiBotManager ตั้งขีดจำกัด 15", threadID, messageID);
                        break;
                    }
                    config.maxMessagesPerMinute = newLimit;
                    if (saveConfig(config)) {
                        api.sendMessage(`✅ ตั้งขีดจำกัดข้อความใหม่: ${newLimit} ข้อความต่อนาที`, threadID, messageID);
                    } else {
                        api.sendMessage("❌ เกิดข้อผิดพลาดในการตั้งขีดจำกัด", threadID, messageID);
                    }
                    break;

                case 'setwarning':
                case 'ตั้งการเตือน':
                    const newWarningCount = parseInt(args[1]);
                    if (!newWarningCount || newWarningCount <= 0) {
                        api.sendMessage("❌ กรุณาระบุจำนวนการเตือนก่อนเตะ (ตัวเลขบวก)\nตัวอย่าง: antiBotManager ตั้งการเตือน 5", threadID, messageID);
                        break;
                    }
                    config.warningCount = newWarningCount;
                    if (saveConfig(config)) {
                        api.sendMessage(`✅ ตั้งจำนวนการเตือนใหม่: ${newWarningCount} ครั้ง`, threadID, messageID);
                    } else {
                        api.sendMessage("❌ เกิดข้อผิดพลาดในการตั้งการเตือน", threadID, messageID);
                    }
                    break;

                case 'ignore':
                case 'ไม่สนใจ':
                    const ignoreUID = args[1];
                    if (!ignoreUID) {
                        api.sendMessage("❌ กรุณาระบุ UID ที่ต้องการไม่สนใจ\nตัวอย่าง: antiBotManager ไม่สนใจ 61555184860915", threadID, messageID);
                        break;
                    }
                    if (!config.ignoredUIDs.includes(ignoreUID)) {
                        config.ignoredUIDs.push(ignoreUID);
                        if (saveConfig(config)) {
                            api.sendMessage(`✅ เพิ่ม UID ${ignoreUID} ในรายการไม่สนใจแล้ว`, threadID, messageID);
                        } else {
                            api.sendMessage("❌ เกิดข้อผิดพลาดในการเพิ่ม UID", threadID, messageID);
                        }
                    } else {
                        api.sendMessage("⚠️ UID นี้อยู่ในรายการไม่สนใจอยู่แล้ว", threadID, messageID);
                    }
                    break;

                case 'unignore':
                case 'สนใจ':
                    const unignoreUID = args[1];
                    if (!unignoreUID) {
                        api.sendMessage("❌ กรุณาระบุ UID ที่ต้องการเอาออกจากรายการไม่สนใจ\nตัวอย่าง: antiBotManager สนใจ 61555184860915", threadID, messageID);
                        break;
                    }
                    const index = config.ignoredUIDs.indexOf(unignoreUID);
                    if (index > -1) {
                        config.ignoredUIDs.splice(index, 1);
                        if (saveConfig(config)) {
                            api.sendMessage(`✅ เอา UID ${unignoreUID} ออกจากรายการไม่สนใจแล้ว`, threadID, messageID);
                        } else {
                            api.sendMessage("❌ เกิดข้อผิดพลาดในการลบ UID", threadID, messageID);
                        }
                    } else {
                        api.sendMessage("⚠️ UID นี้ไม่อยู่ในรายการไม่สนใจ", threadID, messageID);
                    }
                    break;

                case 'threadon':
                case 'เปิดกลุ่ม':
                    if (!config.threads[threadID]) {
                        config.threads[threadID] = {};
                    }
                    config.threads[threadID].enabled = true;
                    if (saveConfig(config)) {
                        api.sendMessage("✅ เปิดระบบ Anti-Bot สำหรับกลุ่มนี้แล้ว", threadID, messageID);
                    } else {
                        api.sendMessage("❌ เกิดข้อผิดพลาดในการเปิดระบบสำหรับกลุ่ม", threadID, messageID);
                    }
                    break;

                case 'threadoff':
                case 'ปิดกลุ่ม':
                    if (!config.threads[threadID]) {
                        config.threads[threadID] = {};
                    }
                    config.threads[threadID].enabled = false;
                    if (saveConfig(config)) {
                        api.sendMessage("✅ ปิดระบบ Anti-Bot สำหรับกลุ่มนี้แล้ว", threadID, messageID);
                    } else {
                        api.sendMessage("❌ เกิดข้อผิดพลาดในการปิดระบบสำหรับกลุ่ม", threadID, messageID);
                    }
                    break;

                case 'status':
                case 'สถานะ':
                case undefined:
                    const threadStatus = config.threads[threadID]?.enabled !== false;
                    const ignoredList = config.ignoredUIDs.length > 0 ? config.ignoredUIDs.join(', ') : 'ไม่มี';
                    
                    const statusMessage = `🤖 สถานะระบบ Anti-Bot\n` +
                                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                                        `📊 สถานะทั่วไป: ${config.enabled ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน'}\n` +
                                        `📊 สถานะกลุ่มนี้: ${threadStatus ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน'}\n` +
                                        `⚡ ขีดจำกัด: ${config.maxMessagesPerMinute} ข้อความ/นาที\n` +
                                        `⚠️ การเตือน: ${config.warningCount} ครั้งก่อนเตะ\n` +
                                        `⏱️ หน้าต่างเวลา: ${config.timeWindow / 1000} วินาที\n` +
                                        `🚫 UID ที่ไม่สนใจ: ${ignoredList}\n` +
                                        `👑 แอดมิน: ${config.adminUID}\n\n` +
                                        `📋 คำสั่งที่ใช้ได้ (เฉพาะแอดมิน):\n` +
                                        `• ${prefix}antiBotManager เปิด/ปิด - เปิด/ปิดระบบ\n` +
                                        `• ${prefix}antiBotManager ตั้งขีดจำกัด <จำนวน> - ตั้งขีดจำกัดข้อความ\n` +
                                        `• ${prefix}antiBotManager ตั้งการเตือน <จำนวน> - ตั้งจำนวนการเตือน\n` +
                                        `• ${prefix}antiBotManager ไม่สนใจ <UID> - เพิ่ม UID ไม่สนใจ\n` +
                                        `• ${prefix}antiBotManager สนใจ <UID> - ลบ UID ไม่สนใจ\n` +
                                        `• ${prefix}antiBotManager เปิดกลุ่ม/ปิดกลุ่ม - จัดการกลุ่มเฉพาะ\n` +
                                        `• ${prefix}antiBotManager สถานะ - ดูสถานะปัจจุบัน`;
                    
                    api.sendMessage(statusMessage, threadID, messageID);
                    break;

                default:
                    api.sendMessage(`❌ คำสั่งไม่ถูกต้อง\nใช้: ${prefix}antiBotManager สถานะ เพื่อดูคำสั่งที่ใช้ได้`, threadID, messageID);
                    break;
            }
        } catch (error) {
            console.error('[Anti-Bot Manager Error]:', error);
            api.sendMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`, threadID, messageID);
        }
    }
};
