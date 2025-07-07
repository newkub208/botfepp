const fs = require('fs');
const path = require('path');

// ไฟล์เก็บการตั้งค่าการเช็กคำหยาบของแต่ละกลุ่ม
const badwordConfigPath = path.join(__dirname, '../../badword_config.json');

// คำหยาบที่จะเช็ก (สามารถปรับแต่งได้)
const DEFAULT_BADWORDS = [
    // คำหยาบภาษาไทย
    'ไอ้สัส', 'ไอสัส', 'สัส', 'ห่า', 'ฟัค', 'fuck', 'shit', 'damn', 'เหี้ย', 'ระยำ', 
    'ล้วน', 'ควย', 'หี', 'เย็ด', 'เสือก', 'กาก', 'ขี้', 'บ้า', 'เปิด', 'ไอ้บ้า',
    'ไอ้กาก', 'ไอ้ขี้', 'แม่ง', 'มึง', 'กู', 'ไอ้กู', 'ไอ้มึง', 'วะ', 'เว้ย',
    // คำหยาบภาษาอังกฤษ
    'bitch', 'bastard', 'asshole', 'motherfucker', 'dickhead', 'cunt', 'whore',
    'slut', 'faggot', 'nigger', 'retard', 'gay', 'lesbian', 'homo'
];

// โหลดการตั้งค่า
function loadBadwordConfig() {
    try {
        if (fs.existsSync(badwordConfigPath)) {
            return JSON.parse(fs.readFileSync(badwordConfigPath, 'utf8'));
        }
    } catch (error) {
        console.error('Error loading badword config:', error);
    }
    return {};
}

// บันทึกการตั้งค่า
function saveBadwordConfig(config) {
    try {
        fs.writeFileSync(badwordConfigPath, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Error saving badword config:', error);
    }
}

// เช็กว่าข้อความมีคำหยาบหรือไม่
function containsBadword(message, customBadwords = []) {
    const allBadwords = [...DEFAULT_BADWORDS, ...customBadwords];
    const lowerMessage = message.toLowerCase();
    
    return allBadwords.some(badword => lowerMessage.includes(badword.toLowerCase()));
}

// ตรวจสอบสิทธิ์ของบอทในกลุ่ม
async function checkBotPermissions(api, threadID) {
    try {
        const threadInfo = await api.getThreadInfo(threadID);
        const botUserID = api.getCurrentUserID();
        
        return {
            threadType: threadInfo.threadType || 'Unknown',
            memberCount: threadInfo.participantIDs ? threadInfo.participantIDs.length : 0,
            isAdmin: threadInfo.adminIDs ? threadInfo.adminIDs.some(admin => admin.id === botUserID) : false
        };
    } catch (error) {
        return {
            threadType: 'Unknown',
            memberCount: 0,
            isAdmin: false,
            error: error.message
        };
    }
}

module.exports = {
    name: "เช็กคำหยาบ",
    description: "เปิด/ปิดการเช็กคำหยาบและเตะสมาชิกออกจากกลุ่มหากพิมพ์คำหยาบ",
    nashPrefix: true,
    version: "1.0.0",
    role: "admin",
    cooldowns: 3,
    aliases: ["badword", "คำหยาบ", "filter"],
    
    async execute(api, event, args) {
        const { threadID, messageID, senderID } = event;
        
        // โหลดการตั้งค่า
        const config = loadBadwordConfig();
        
        if (args.length === 0) {
            const isEnabled = config[threadID]?.enabled || false;
            const customWords = config[threadID]?.customWords || [];
            
            let message = "🛡️ การตั้งค่าเช็กคำหยาบ\n";
            message += "═══════════════════\n\n";
            message += `สถานะ: ${isEnabled ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน'}\n`;
            message += `คำหยาบพิเศษ: ${customWords.length} คำ\n\n`;
            message += "🔧 วิธีใช้งาน:\n";
            message += "• เช็กคำหยาบ เปิด - เปิดใช้งาน\n";
            message += "• เช็กคำหยาบ ปิด - ปิดใช้งาน\n";
            message += "• เช็กคำหยาบ เพิ่ม [คำ] - เพิ่มคำหยาบ\n";
            message += "• เช็กคำหยาบ ลบ [คำ] - ลบคำหยาบ\n";
            message += "• เช็กคำหยาบ รายการ - ดูคำหยาบทั้งหมด\n";
            message += "• เช็กคำหยาบ สถานะ - ตรวจสอบสิทธิ์บอท\n\n";
            message += "⚠️ หมายเหตุ: เมื่อเปิดใช้งาน สมาชิกที่พิมพ์คำหยาบจะถูกเตะออกจากกลุ่มทันที!";
            
            return api.sendMessage(message, threadID, messageID);
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'เปิด':
            case 'on':
            case 'enable':
                if (!config[threadID]) config[threadID] = {};
                config[threadID].enabled = true;
                saveBadwordConfig(config);
                
                return api.sendMessage(
                    "🟢 เปิดใช้งานการเช็กคำหยาบแล้ว!\n\n" +
                    "⚠️ สมาชิกที่พิมพ์คำหยาบจะถูกเตะออกจากกลุ่มทันที",
                    threadID, messageID
                );
                
            case 'ปิด':
            case 'off':
            case 'disable':
                if (!config[threadID]) config[threadID] = {};
                config[threadID].enabled = false;
                saveBadwordConfig(config);
                
                return api.sendMessage(
                    "🔴 ปิดใช้งานการเช็กคำหยาบแล้ว",
                    threadID, messageID
                );
                
            case 'เพิ่ม':
            case 'add':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุคำที่ต้องการเพิ่ม\nตัวอย่าง: เช็กคำหยาบ เพิ่ม คำที่ไม่ดี",
                        threadID, messageID
                    );
                }
                
                const wordToAdd = args.slice(1).join(' ');
                if (!config[threadID]) config[threadID] = { enabled: false, customWords: [] };
                if (!config[threadID].customWords) config[threadID].customWords = [];
                
                if (!config[threadID].customWords.includes(wordToAdd)) {
                    config[threadID].customWords.push(wordToAdd);
                    saveBadwordConfig(config);
                    
                    return api.sendMessage(
                        `✅ เพิ่มคำ "${wordToAdd}" ในรายการคำหยาบแล้ว`,
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ คำ "${wordToAdd}" มีอยู่ในรายการแล้ว`,
                        threadID, messageID
                    );
                }
                
            case 'ลบ':
            case 'remove':
            case 'delete':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุคำที่ต้องการลบ\nตัวอย่าง: เช็กคำหยาบ ลบ คำที่ไม่ดี",
                        threadID, messageID
                    );
                }
                
                const wordToRemove = args.slice(1).join(' ');
                if (!config[threadID] || !config[threadID].customWords) {
                    return api.sendMessage(
                        "❌ ไม่มีคำหยาบพิเศษในกลุ่มนี้",
                        threadID, messageID
                    );
                }
                
                const index = config[threadID].customWords.indexOf(wordToRemove);
                if (index !== -1) {
                    config[threadID].customWords.splice(index, 1);
                    saveBadwordConfig(config);
                    
                    return api.sendMessage(
                        `✅ ลบคำ "${wordToRemove}" จากรายการคำหยาบแล้ว`,
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ ไม่พบคำ "${wordToRemove}" ในรายการ`,
                        threadID, messageID
                    );
                }
                
            case 'รายการ':
            case 'list':
                const customWords = config[threadID]?.customWords || [];
                
                let listMessage = "📋 รายการคำหยาบ\n";
                listMessage += "═══════════════\n\n";
                listMessage += `🔧 คำหยาบพื้นฐาน: ${DEFAULT_BADWORDS.length} คำ\n`;
                listMessage += `🔧 คำหยาบพิเศษ: ${customWords.length} คำ\n\n`;
                
                if (customWords.length > 0) {
                    listMessage += "📝 คำหยาบพิเศษในกลุ่มนี้:\n";
                    customWords.forEach((word, index) => {
                        listMessage += `${index + 1}. ${word}\n`;
                    });
                } else {
                    listMessage += "ไม่มีคำหยาบพิเศษในกลุ่มนี้";
                }
                
                return api.sendMessage(listMessage, threadID, messageID);
                
            case 'สถานะ':
            case 'status':
                const permissions = await checkBotPermissions(api, threadID);
                
                let statusMessage = "🔍 สถานะระบบเช็กคำหยาบ\n";
                statusMessage += "═══════════════════\n\n";
                statusMessage += `📱 ประเภทกลุ่ม: ${permissions.threadType}\n`;
                statusMessage += `👥 จำนวนสมาชิก: ${permissions.memberCount} คน\n`;
                statusMessage += `🛡️ สิทธิ์บอท: ${permissions.isAdmin ? '✅ แอดมิน' : '❌ ไม่เป็นแอดมิน'}\n`;
                statusMessage += `🔧 การเช็กคำหยาบ: ${config[threadID]?.enabled ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน'}\n\n`;
                
                if (!permissions.isAdmin) {
                    statusMessage += "⚠️ คำเตือน: บอทไม่มีสิทธิ์แอดมิน!\n";
                    statusMessage += "กรุณาให้สิทธิ์แอดมินกับบอทเพื่อให้สามารถเตะสมาชิกได้";
                } else {
                    statusMessage += "✅ ระบบพร้อมใช้งาน";
                }
                
                return api.sendMessage(statusMessage, threadID, messageID);
                
            default:
                return api.sendMessage(
                    "❌ คำสั่งไม่ถูกต้อง\nใช้: เช็กคำหยาบ [เปิด/ปิด/เพิ่ม/ลบ/รายการ]",
                    threadID, messageID
                );
        }
    },
    
    // ฟังก์ชันเช็กข้อความทุกครั้งที่มีคนส่งข้อความ
    checkMessage: async (api, event) => {
        const { threadID, senderID, body } = event;
        
        // ข้ามถ้าไม่มีข้อความ
        if (!body) return;
        
        // โหลดการตั้งค่า
        const config = loadBadwordConfig();
        const groupConfig = config[threadID];
        
        // ข้ามถ้าไม่ได้เปิดใช้งานในกลุ่มนี้
        if (!groupConfig || !groupConfig.enabled) return;
        
        // ข้ามถ้าเป็นแอดมิน (ถ้าต้องการให้แอดมินไม่โดนเตะ)
        const botConfig = require('../../config.json');
        if (senderID === botConfig.adminUID) return;
        
        // เช็กคำหยาบ
        const customWords = groupConfig.customWords || [];
        if (containsBadword(body, customWords)) {
            try {
                // ตรวจสอบว่าผู้ใช้ยังอยู่ในกลุ่มหรือไม่ก่อนเตะ
                const threadInfo = await api.getThreadInfo(threadID);
                if (threadInfo && threadInfo.participantIDs && threadInfo.participantIDs.includes(senderID)) {
                    // เตะสมาชิกออกทันทีโดยไม่แจ้งเตือน
                    await api.removeUserFromGroup(senderID, threadID);
                    console.log(`[BADWORD] Silently removed user ${senderID} from group ${threadID}`);
                } else {
                    console.log(`[BADWORD] User ${senderID} is not in group ${threadID}, skipping removal`);
                }
            } catch (error) {
                // ตรวจสอบว่าเป็น error เพราะผู้ใช้ไม่อยู่ในกลุ่มหรือไม่
                if (error.payload && error.payload.includes('not a participant')) {
                    console.log(`[BADWORD] User ${senderID} is no longer in group ${threadID}`);
                } else {
                    console.log(`[BADWORD] Failed to remove user ${senderID} from group ${threadID}:`, error.errorSummary || error.message);
                }
            }
        }
    }
};

// เพิ่มการเช็กข้อความเข้าไปใน handleMessage ของระบบหลัก
// นี่จะถูกเรียกใช้โดยอัตโนมัติเมื่อมีข้อความใหม่
if (global.NashBoT && global.NashBoT.messageHandlers) {
    global.NashBoT.messageHandlers.push(module.exports.checkMessage);
} else {
    if (!global.NashBoT) global.NashBoT = {};
    if (!global.NashBoT.messageHandlers) global.NashBoT.messageHandlers = [];
    global.NashBoT.messageHandlers.push(module.exports.checkMessage);
}
