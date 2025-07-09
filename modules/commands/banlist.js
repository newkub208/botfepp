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

// --- ฟังก์ชันตรวจสอบว่าการแบนหมดอายุแล้วหรือไม่ ---
function isBanExpired(banInfo) {
    if (!banInfo.banUntil) return false; // แบนถาวร
    return Date.now() > banInfo.banUntil;
}

module.exports = {
    name: "banlist",
    description: "แสดงรายชื่อผู้ใช้ที่ถูกแบน (สำหรับแอดมินเท่านั้น)",
    version: "1.0.0",
    aliases: ["รายชื่อแบน"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;

        // --- 1. ตรวจสอบสิทธิ์ผู้ใช้งาน ---
        if (!hasPermission(senderID)) {
            return api.sendMessage("คำสั่งนี้สำหรับแอดมินเท่านั้นครับ", threadID, messageID);
        }

        try {
            const bannedUsers = loadBannedUsers();
            const userIds = Object.keys(bannedUsers);

            if (userIds.length === 0) {
                return api.sendMessage("📋 ไม่มีผู้ใช้ที่ถูกแบนในขณะนี้", threadID, messageID);
            }

            // ทำความสะอาดรายชื่อผู้ใช้ที่หมดอายุการแบน
            const cleanedBannedUsers = {};
            let hasExpired = false;

            for (const userId of userIds) {
                const banInfo = bannedUsers[userId];
                if (!isBanExpired(banInfo)) {
                    cleanedBannedUsers[userId] = banInfo;
                } else {
                    hasExpired = true;
                }
            }

            // บันทึกรายชื่อที่ทำความสะอาดแล้ว
            if (hasExpired) {
                saveBannedUsers(cleanedBannedUsers);
            }

            const activeBannedUsers = Object.keys(cleanedBannedUsers);

            if (activeBannedUsers.length === 0) {
                return api.sendMessage("📋 ไม่มีผู้ใช้ที่ถูกแบนในขณะนี้ (การแบนทั้งหมดหมดอายุแล้ว)", threadID, messageID);
            }

            // แสดงรายชื่อผู้ใช้ที่ถูกแบน
            let banListMessage = `📋 รายชื่อผู้ใช้ที่ถูกแบน (${activeBannedUsers.length} คน):\n\n`;

            for (let i = 0; i < activeBannedUsers.length; i++) {
                const userId = activeBannedUsers[i];
                const banInfo = cleanedBannedUsers[userId];

                try {
                    const userInfo = await api.getUserInfo(userId);
                    const userName = userInfo[userId]?.name || `ผู้ใช้ UID: ${userId}`;

                    let timeLeft = "ถาวร";
                    if (banInfo.banUntil) {
                        const timeLeftMs = banInfo.banUntil - Date.now();
                        const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
                        
                        if (days > 0) {
                            timeLeft = `${days} วัน ${hours} ชั่วโมง`;
                        } else if (hours > 0) {
                            timeLeft = `${hours} ชั่วโมง ${minutes} นาที`;
                        } else {
                            timeLeft = `${minutes} นาที`;
                        }
                    }

                    banListMessage += `${i + 1}. ${userName}\n` +
                        `   💬 เหตุผล: ${banInfo.reason}\n` +
                        `   ⏰ เวลาคงเหลือ: ${timeLeft}\n` +
                        `   📅 ถูกแบนเมื่อ: ${new Date(banInfo.bannedAt).toLocaleString('th-TH')}\n\n`;

                } catch (error) {
                    console.error(`Error getting user info for ${userId}:`, error);
                    banListMessage += `${i + 1}. ผู้ใช้ UID: ${userId}\n` +
                        `   💬 เหตุผล: ${banInfo.reason}\n` +
                        `   ⏰ เวลาคงเหลือ: ${banInfo.banUntil ? 'จำกัดเวลา' : 'ถาวร'}\n` +
                        `   📅 ถูกแบนเมื่อ: ${new Date(banInfo.bannedAt).toLocaleString('th-TH')}\n\n`;
                }
            }

            banListMessage += `💡 ใช้คำสั่ง ${prefix}unban เพื่อปลดแบนผู้ใช้`;

            api.sendMessage(banListMessage, threadID, messageID);

        } catch (err) {
            console.error("Ban list command error:", err);
            api.sendMessage("❌ เกิดข้อผิดพลาดในการแสดงรายชื่อผู้ใช้ที่ถูกแบน", threadID, messageID);
        }
    }
};
