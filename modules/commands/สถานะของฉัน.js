const { loadDetailedAdmins } = require('../../utils/adminManager');
const fs = require('fs');
const path = require('path');

// --- กำหนดค่าคงที่ ---
const SUPER_ADMIN_ID = '61555184860915';
const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json');

// --- ฟังก์ชันโหลดรายชื่อแอดมิน ---
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

module.exports = {
    name: "สถานะของฉัน",
    description: "ตรวจสอบสถานะแอดมินของตัวเอง",
    version: "1.0.0",
    aliases: ["mystatus", "myinfo", "ฉัน", "my-status", "my-info", "me", "profile"],
    nashPrefix: false,
    cooldowns: 2,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;

        try {
            const detailedData = loadDetailedAdmins();
            const admins = loadAdmins();
            const now = new Date();

            let message = `👤 สถานะของคุณ\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            // ดึงข้อมูลผู้ใช้
            let userName = `ผู้ใช้ UID: ${senderID}`;
            try {
                const userInfo = await api.getUserInfo(senderID);
                userName = userInfo[senderID]?.name || userName;
            } catch (e) {
                // ใช้ค่าเริ่มต้น
            }

            message += `📝 ข้อมูลพื้นฐาน:\n`;
            message += `• ชื่อ: ${userName}\n`;
            message += `• UID: ${senderID}\n\n`;

            // ตรวจสอบสถานะแอดมิน
            if (senderID === SUPER_ADMIN_ID) {
                message += `👑 สถานะ: ผู้ดูแลสูงสุด\n`;
                message += `🔓 สิทธิ์: ไม่จำกัด\n`;
                message += `⏰ ระยะเวลา: ไม่หมดอายุ\n`;
                message += `🚫 การเตะ: ไม่จำกัด\n\n`;
                message += `✅ สิทธิ์พิเศษ:\n`;
                message += `• เพิ่ม/ลบแอดมินได้\n`;
                message += `• ตั้งเวลาแอดมินได้ไม่จำกัด\n`;
                message += `• ดูสถิติและประวัติได้\n`;
                message += `• เตะผู้ใช้ได้ไม่จำกัด\n`;
                message += `• จัดการระบบได้ทั้งหมด\n`;
            }
            else if (detailedData.temporaryAdmins[senderID] && 
                     detailedData.temporaryAdmins[senderID].isActive &&
                     new Date(detailedData.temporaryAdmins[senderID].expiresAt) > now) {
                
                const admin = detailedData.temporaryAdmins[senderID];
                const maxKicks = admin.maxKicks || 5; // ใช้ค่าเริ่มต้น 5 ถ้าไม่มีการกำหนด
                const expiresAt = new Date(admin.expiresAt);
                const timeLeft = expiresAt - now;
                const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                message += `🛡️ สถานะ: แอดมินชั่วคราว\n`;
                message += `🔒 สิทธิ์: จำกัด\n`;
                message += `⏰ ระยะเวลาเดิม: ${admin.duration}\n`;
                message += `📅 หมดอายุ: ${expiresAt.toLocaleString('th-TH')}\n`;
                message += `⌛ เวลาที่เหลือ: ${daysLeft}วัน ${hoursLeft}ชม ${minutesLeft}นาที\n`;
                message += `🚫 การเตะ: ${admin.kickCount}/${maxKicks} ครั้ง\n`;
                message += `🎯 เหลือสิทธิ์เตะ: ${maxKicks - admin.kickCount} ครั้ง\n\n`;

                // แสดงข้อมูลเพิ่มเติม
                message += `📊 ข้อมูลเพิ่มเติม:\n`;
                message += `• เพิ่มเมื่อ: ${new Date(admin.addedAt).toLocaleString('th-TH')}\n`;
                if (admin.lastKick) {
                    message += `• เตะครั้งล่าสุด: ${new Date(admin.lastKick).toLocaleString('th-TH')}\n`;
                }

                message += `\n✅ สิทธิ์ที่มี:\n`;
                message += `• เพิ่มแอดมินได้ (สูงสุด 30 วัน)\n`;
                message += `• เตะผู้ใช้ได้ (เหลือ ${maxKicks - admin.kickCount} ครั้ง)\n`;
                message += `• ดูรายชื่อแอดมินได้\n`;
                message += `• ใช้คำสั่งแอดมินอื่นๆ ได้\n`;

                const warningThreshold = Math.ceil(maxKicks * 0.6); // เตือนเมื่อใช้ไป 60%
                if (admin.kickCount >= warningThreshold) {
                    message += `\n⚠️ คำเตือน:\n`;
                    message += `• คุณเตะไปแล้ว ${admin.kickCount} ครั้ง\n`;
                    message += `• หากเตะครบ ${maxKicks} ครั้ง จะถูกลบออกทันที\n`;
                    message += `• โปรดใช้สิทธิ์อย่างระมัดระวัง\n`;
                }

                // แสดงเวลาที่เหลือในแบบเตือน
                if (timeLeft <= 24 * 60 * 60 * 1000) { // น้อยกว่า 24 ชั่วโมง
                    message += `\n🔔 แจ้งเตือน:\n`;
                    message += `• สิทธิ์แอดมินจะหมดอายุในอีก ${hoursLeft}ชม ${minutesLeft}นาที\n`;
                    message += `• ติดต่อผู้ดูแลสูงสุดหากต้องการต่ออายุ\n`;
                }
            }
            else {
                message += `👤 สถานะ: ผู้ใช้ทั่วไป\n`;
                message += `🔒 สิทธิ์: พื้นฐาน\n`;
                message += `⏰ ระยะเวลา: ไม่มีข้อจำกัด\n`;
                message += `🚫 การเตะ: ไม่สามารถเตะได้\n\n`;
                message += `✅ สิทธิ์ที่มี:\n`;
                message += `• ใช้คำสั่งทั่วไปได้\n`;
                message += `• แชทในกลุ่มได้\n`;
                message += `• ใช้ฟีเจอร์พื้นฐานได้\n\n`;
                message += `💡 ข้อมูล:\n`;
                message += `• ไม่สามารถใช้คำสั่งแอดมินได้\n`;
                message += `• ติดต่อแอดมินหากต้องการความช่วยเหลือ\n`;
            }

            message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `📅 ตรวจสอบเมื่อ: ${new Date().toLocaleString('th-TH')}`;

            api.sendMessage(message, threadID, messageID);

        } catch (error) {
            console.error('My status command error:', error);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการตรวจสอบสถานะ\n` +
                `🔧 Error: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
