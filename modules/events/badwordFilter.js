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

// เช็กว่าข้อความมีคำหยาบหรือไม่
function containsBadword(message, customBadwords = []) {
    const allBadwords = [...DEFAULT_BADWORDS, ...customBadwords];
    const lowerMessage = message.toLowerCase();
    
    return allBadwords.some(badword => lowerMessage.includes(badword.toLowerCase()));
}

module.exports = {
    name: "badwordFilter",
    description: "ระบบกรองคำหยาบอัตโนมัติ",
    
    async onEvent({ api, event, prefix }) {
        // เช็กเฉพาะข้อความในแชท
        if (event.type !== 'message' || !event.body) return;
        
        const { threadID, senderID, body } = event;
        
        // โหลดการตั้งค่า
        const config = loadBadwordConfig();
        const groupConfig = config[threadID];
        
        // ข้ามถ้าไม่ได้เปิดใช้งานในกลุ่มนี้
        if (!groupConfig || !groupConfig.enabled) return;
        
        // ข้ามถ้าเป็นแอดมิน
        const botConfig = require('../../config.json');
        if (senderID === botConfig.adminUID) return;
        
        // เช็กคำหยาบ
        const customWords = groupConfig.customWords || [];
        if (containsBadword(body, customWords)) {
            try {
                // ตรวจสอบว่าผู้ใช้ยังอยู่ในกลุ่มหรือไม่ก่อนเตะ
                const threadInfo = await api.getThreadInfo(threadID);
                if (threadInfo && threadInfo.participantIDs && threadInfo.participantIDs.includes(senderID)) {
                    // เตะสมาชิกออกจากกลุ่มโดยไม่แจ้งเตือน
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
                    console.error('Error removing user for bad words:', error);
                }
            }
        }
    }
};
