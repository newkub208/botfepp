const fs = require('fs');
const path = require('path');

// --- กำหนดค่าคงที่ ---
const SUPER_ADMIN_ID = '61555184860915'; // ไอดีของผู้ใช้ที่มีสิทธิ์สูงสุด
const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json'); // ที่อยู่ของไฟล์เก็บรายชื่อแอดมิน
const BAN_FILE_PATH = path.join(__dirname, '../../ban_list.json'); // ที่อยู่ของไฟล์เก็บรายชื่อผู้ใช้ที่ถูกแบน

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

// --- ฟังก์ชันสำหรับโหลดรายชื่อผู้ใช้ที่ถูกแบน ---
function loadBannedUsers() {
    try {
        if (fs.existsSync(BAN_FILE_PATH)) {
            const data = fs.readFileSync(BAN_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading ban list:', error);
    }
    return {};
}

// --- ฟังก์ชันสำหรับบันทึกรายชื่อผู้ใช้ที่ถูกแบน ---
function saveBannedUsers(bannedUsers) {
    try {
        fs.writeFileSync(BAN_FILE_PATH, JSON.stringify(bannedUsers, null, 2));
    } catch (error) {
        console.error('Error saving ban list:', error);
    }
}

// --- ฟังก์ชันตรวจสอบสิทธิ์ ---
function hasPermission(senderID) {
    const admins = loadAdmins();
    return senderID === SUPER_ADMIN_ID || admins.includes(senderID);
}

module.exports = {
    name: "unban",
    description: "ปลดแบนผู้ใช้ (สำหรับแอดมินเท่านั้น)",
    version: "1.0.0",
    aliases: ["ปลดแบน"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, type, messageReply } = event;

        // --- 1. ตรวจสอบสิทธิ์ผู้ใช้งาน ---
        if (!hasPermission(senderID)) {
            return api.sendMessage("คำสั่งนี้สำหรับแอดมินเท่านั้นครับ", threadID, messageID);
        }

        // --- 2. หาเป้าหมายที่จะปลดแบน ---
        let targetID = "";
        
        if (type === "message_reply") {
            targetID = messageReply.senderID;
        } else if (args.length > 0) {
            targetID = args[0].replace(/[@]/g, '');
        } else {
            return api.sendMessage(
                `วิธีใช้คำสั่ง:\n` +
                `• ตอบกลับข้อความแล้วพิมพ์ ${prefix}unban\n` +
                `• พิมพ์ ${prefix}unban @user\n` +
                `• พิมพ์ ${prefix}unban [UID ของผู้ใช้]`,
                threadID,
                messageID
            );
        }

        // --- 3. ตรวจสอบความถูกต้องของ targetID ---
        if (!targetID || !/^\d+$/.test(targetID)) {
            return api.sendMessage("ไม่พบผู้ใช้ที่ต้องการปลดแบน", threadID, messageID);
        }

        // --- 4. จัดการข้อมูลการปลดแบน ---
        try {
            const bannedUsers = loadBannedUsers();

            // ตรวจสอบว่าผู้ใช้ถูกแบนหรือไม่
            if (!bannedUsers[targetID]) {
                return api.sendMessage(`ผู้ใช้ UID: ${targetID} ไม่ได้ถูกแบน`, threadID, messageID);
            }

            // เก็บข้อมูลการแบนก่อนลบ
            const banInfo = bannedUsers[targetID];
            
            // ลบออกจากรายชื่อผู้ถูกแบน
            delete bannedUsers[targetID];
            saveBannedUsers(bannedUsers);

            // ดึงชื่อผู้ใช้เพื่อแสดงในข้อความตอบกลับ
            const userInfo = await api.getUserInfo(targetID);
            const targetName = userInfo[targetID]?.name || `ผู้ใช้ UID: ${targetID}`;

            const unbanMessage = `✅ ปลดแบน "${targetName}" เรียบร้อยแล้ว\n` +
                `📝 เหตุผลที่ถูกแบน: ${banInfo.reason}\n` +
                `⏰ ถูกแบนเมื่อ: ${new Date(banInfo.bannedAt).toLocaleString('th-TH')}\n` +
                `👤 ถูกแบนโดย: ${banInfo.bannedBy}`;

            api.sendMessage(unbanMessage, threadID, messageID);

        } catch (err) {
            console.error("Unban command error:", err);
            api.sendMessage("❌ เกิดข้อผิดพลาดในการปลดแบนผู้ใช้", threadID, messageID);
        }
    }
};
