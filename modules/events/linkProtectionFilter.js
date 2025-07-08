const fs = require('fs');
const path = require('path');

const LINK_PROTECTION_CONFIG_FILE = path.join(__dirname, 'linkProtectionState.json');

// ฟังก์ชันโหลดการตั้งค่า
function loadLinkProtectionConfig() {
    try {
        if (fs.existsSync(LINK_PROTECTION_CONFIG_FILE)) {
            const data = fs.readFileSync(LINK_PROTECTION_CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading link protection config:', error);
    }
    return {};
}

// ฟังก์ชันตรวจสอบลิ้ง
function containsLink(text, customDomains = [], whitelist = []) {
    if (!text || typeof text !== 'string') return false;
    
    const message = text.toLowerCase();
    
    // ตรวจสอบ whitelist ก่อน - ถ้าพบในรายการอนุญาตให้ผ่าน
    for (const allowedDomain of whitelist) {
        const allowPattern = new RegExp(allowedDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (allowPattern.test(message)) {
            return false; // อนุญาตให้ผ่าน
        }
    }
    
    // รูปแบบลิ้งพื้นฐาน
    const basicPatterns = [
        /https?:\/\/[^\s]+/i,           // http:// หรือ https://
        /www\.[^\s]+\.[a-z]{2,}/i,     // www.example.com
        /[a-z0-9-]+\.(com|net|org|co\.th|th|io|me|cc|tv|tk|ml|ga|cf)[^\s]*/i, // โดเมนทั่วไป
        /facebook\.com[^\s]*/i,         // Facebook
        /fb\.com[^\s]*/i,              // FB short link
        /youtube\.com[^\s]*/i,         // YouTube
        /youtu\.be[^\s]*/i,            // YouTube short link
        /bit\.ly[^\s]*/i,              // Bitly
        /tinyurl\.com[^\s]*/i,         // TinyURL
        /t\.co[^\s]*/i,                // Twitter
        /instagram\.com[^\s]*/i,       // Instagram
        /tiktok\.com[^\s]*/i,          // TikTok
        /discord\.gg[^\s]*/i,          // Discord invite
        /telegram\.me[^\s]*/i,         // Telegram
        /line\.me[^\s]*/i              // Line
    ];
    
    // ตรวจสอบรูปแบบพื้นฐาน
    for (const pattern of basicPatterns) {
        if (pattern.test(message)) {
            return true;
        }
    }
    
    // ตรวจสอบโดเมนพิเศษ
    for (const domain of customDomains) {
        const domainPattern = new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (domainPattern.test(message)) {
            return true;
        }
    }
    
    // ตรวจสอบรูปแบบ IP address
    const ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]+\b/;
    if (ipPattern.test(message)) {
        return true;
    }
    
    // ตรวจสอบรูปแบบ email ที่มี @ และ domain
    const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
    if (emailPattern.test(message)) {
        return true;
    }
    
    return false;
}

module.exports = {
    name: "linkProtectionFilter",
    version: "1.0.0",
    description: "ป้องกันการส่งลิ้งในกลุ่ม",
    author: "NashBot",
    
    async onEvent({ api, event, prefix }) {
        // เช็กเฉพาะข้อความในแชท
        if (event.type !== 'message' || !event.body) return;
        
        const { threadID, senderID, body } = event;
        
        // โหลดการตั้งค่า
        const config = loadLinkProtectionConfig();
        const groupConfig = config[threadID];
        
        // ข้ามถ้าไม่ได้เปิดใช้งานในกลุ่มนี้
        if (!groupConfig || !groupConfig.enabled) return;
        
        // ข้ามถ้าเป็นแอดมิน
        try {
            const botConfig = require('../../config.json');
            if (senderID === botConfig.adminUID) return;
        } catch (error) {
            console.error('Error loading config for link protection:', error);
        }
        
        // ข้ามถ้าเป็นข้อความจากบอทเอง
        if (senderID === api.getCurrentUserID()) return;
        
        // เช็กลิ้ง
        const customDomains = groupConfig.customDomains || [];
        const whitelist = groupConfig.whitelist || [];
        
        if (containsLink(body, customDomains, whitelist)) {
            try {
                // ตรวจสอบว่าผู้ใช้ยังอยู่ในกลุ่มหรือไม่ก่อนเตะ
                const threadInfo = await api.getThreadInfo(threadID);
                if (threadInfo && threadInfo.participantIDs && threadInfo.participantIDs.includes(senderID)) {
                    // ลบข้อความที่มีลิ้ง
                    try {
                        await api.unsendMessage(event.messageID);
                    } catch (deleteError) {
                        console.log(`[LINK PROTECTION] Cannot delete message: ${deleteError.message}`);
                    }
                    
                    // เตะสมาชิกออกจากกลุ่มโดยไม่แจ้งเตือน
                    await api.removeUserFromGroup(senderID, threadID);
                    console.log(`[LINK PROTECTION] Removed user ${senderID} from group ${threadID} for sending link`);
                    
                    // ส่งข้อความแจ้งเตือน (ไม่บังคับ)
                    const userInfo = await api.getUserInfo(senderID);
                    const userName = userInfo[senderID]?.name || 'ผู้ใช้';
                    
                    const warningMessage = `🛡️ ระบบป้องกันลิ้ง\n\n` +
                        `👤 ${userName} ถูกเตะออกจากกลุ่มเนื่องจากส่งลิ้ง\n\n` +
                        `⚠️ การส่งลิ้งในกลุ่มนี้ถูกห้าม!`;
                    
                    setTimeout(() => {
                        api.sendMessage(warningMessage, threadID);
                    }, 1000);
                    
                } else {
                    console.log(`[LINK PROTECTION] User ${senderID} is not in group ${threadID}, skipping removal`);
                }
            } catch (error) {
                console.error('Error removing user for sending link:', error);
                
                // ตรวจสอบว่าเป็น error เพราะผู้ใช้ไม่อยู่ในกลุ่มหรือไม่
                if (error.payload && error.payload.includes('not a participant')) {
                    console.log(`[LINK PROTECTION] User ${senderID} is no longer in group ${threadID}`);
                } else {
                    // ถ้าเตะไม่ได้ อย่างน้อยก็ลบข้อความ
                    try {
                        await api.unsendMessage(event.messageID);
                        
                        const warningMessage = `🛡️ ตรวจพบลิ้งในข้อความ!\n\n` +
                            `⚠️ การส่งลิ้งในกลุ่มนี้ถูกห้าม\n` +
                            `ข้อความได้ถูกลบแล้ว`;
                        
                        api.sendMessage(warningMessage, threadID);
                    } catch (deleteError) {
                        console.error('Cannot delete message with link:', deleteError);
                    }
                }
            }
        }
    }
};
