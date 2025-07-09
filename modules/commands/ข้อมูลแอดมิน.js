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

// --- ฟังก์ชันตรวจสอบสิทธิ์ ---
function hasPermission(senderID) {
    const admins = loadAdmins();
    return senderID === SUPER_ADMIN_ID || admins.includes(senderID);
}

module.exports = {
    name: "ข้อมูลแอดมิน",
    description: "ดูข้อมูลรายละเอียดของแอดมินคนหนึ่ง",
    version: "1.0.0",
    aliases: ["admininfo", "ดูแอดมิน", "แอดมินคนนี้", "admin-info", "admin-detail", "admindetail"],
    nashPrefix: false,
    cooldowns: 2,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, type, messageReply } = event;

        // ตรวจสอบสิทธิ์ผู้ใช้งาน
        if (!hasPermission(senderID)) {
            return api.sendMessage("❌ คำสั่งนี้สำหรับแอดมินเท่านั้น", threadID, messageID);
        }

        try {
            const detailedData = loadDetailedAdmins();
            const now = new Date();

            // หาเป้าหมาย
            let targetID = "";
            if (type === "message_reply") {
                targetID = messageReply.senderID;
            } else if (args.length > 0 && /^\d+$/.test(args[0])) {
                targetID = args[0];
            } else {
                return api.sendMessage(
                    `📝 วิธีใช้คำสั่ง:\n` +
                    `• ตอบกลับข้อความแล้วพิมพ์ ${prefix}ข้อมูลแอดมิน\n` +
                    `• พิมพ์ ${prefix}ข้อมูลแอดมิน [UID]\n\n` +
                    `🔍 ตัวอย่าง:\n` +
                    `${prefix}ข้อมูลแอดมิน 61574221880222`,
                    threadID,
                    messageID
                );
            }

            // ตรวจสอบข้อมูลเป้าหมาย
            let targetName = `ผู้ใช้ UID: ${targetID}`;
            try {
                const userInfo = await api.getUserInfo(targetID);
                targetName = userInfo[targetID]?.name || targetName;
            } catch (e) {
                // ใช้ค่าเริ่มต้น
            }

            let message = `👤 ข้อมูลแอดมิน\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            message += `📝 ข้อมูลพื้นฐาน:\n`;
            message += `• ชื่อ: ${targetName}\n`;
            message += `• UID: ${targetID}\n\n`;

            // ตรวจสอบสถานะ
            if (targetID === SUPER_ADMIN_ID) {
                message += `👑 สถานะ: ผู้ดูแลสูงสุด\n`;
                message += `🔓 สิทธิ์: ไม่จำกัด\n`;
                message += `⏰ ระยะเวลา: ไม่หมดอายุ\n`;
                message += `🚫 การเตะ: ไม่จำกัด\n\n`;
                message += `✅ สิทธิ์พิเศษ:\n`;
                message += `• เพิ่ม/ลบแอดมินได้\n`;
                message += `• ตั้งเวลาแอดมินได้ไม่จำกัด\n`;
                message += `• ตั้งจำนวนการเตะได้\n`;
                message += `• ดูสถิติและประวัติได้\n`;
                message += `• เตะผู้ใช้ได้ไม่จำกัด\n`;
                message += `• จัดการระบบได้ทั้งหมด\n`;
            } 
            else if (detailedData.temporaryAdmins[targetID] && 
                     detailedData.temporaryAdmins[targetID].isActive &&
                     new Date(detailedData.temporaryAdmins[targetID].expiresAt) > now) {
                
                const admin = detailedData.temporaryAdmins[targetID];
                const maxKicks = admin.maxKicks || 5;
                const expiresAt = new Date(admin.expiresAt);
                const timeLeft = expiresAt - now;
                const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

                message += `🛡️ สถานะ: แอดมินชั่วคราว\n`;
                message += `🔒 สิทธิ์: จำกัด\n`;
                message += `⏰ ระยะเวลาเดิม: ${admin.duration}\n`;
                message += `📅 เพิ่มเมื่อ: ${new Date(admin.addedAt).toLocaleString('th-TH')}\n`;
                message += `📅 หมดอายุ: ${expiresAt.toLocaleString('th-TH')}\n`;
                message += `⌛ เวลาที่เหลือ: ${daysLeft}วัน ${hoursLeft}ชม ${minutesLeft}นาที\n\n`;

                message += `🚫 ข้อมูลการเตะ:\n`;
                message += `• จำนวนการเตะที่กำหนด: ${maxKicks} ครั้ง\n`;
                message += `• การเตะที่ใช้ไป: ${admin.kickCount} ครั้ง\n`;
                message += `• การเตะที่เหลือ: ${maxKicks - admin.kickCount} ครั้ง\n`;
                message += `• เปอร์เซ็นต์การใช้งาน: ${((admin.kickCount / maxKicks) * 100).toFixed(1)}%\n`;
                
                if (admin.lastKick) {
                    message += `• เตะครั้งล่าสุด: ${new Date(admin.lastKick).toLocaleString('th-TH')}\n`;
                } else {
                    message += `• เตะครั้งล่าสุด: ยังไม่เคยเตะ\n`;
                }

                message += `\n📊 ข้อมูลการจัดการ:\n`;
                
                // ดึงข้อมูลผู้เพิ่ม
                try {
                    const adderInfo = await api.getUserInfo(admin.addedBy);
                    const adderName = adderInfo[admin.addedBy]?.name || `UID: ${admin.addedBy}`;
                    message += `• เพิ่มโดย: ${adderName}\n`;
                } catch (e) {
                    message += `• เพิ่มโดย: UID: ${admin.addedBy}\n`;
                }

                if (admin.lastUpdated) {
                    message += `• อัพเดทล่าสุด: ${new Date(admin.lastUpdated).toLocaleString('th-TH')}\n`;
                    if (admin.updatedBy) {
                        try {
                            const updaterInfo = await api.getUserInfo(admin.updatedBy);
                            const updaterName = updaterInfo[admin.updatedBy]?.name || `UID: ${admin.updatedBy}`;
                            message += `• อัพเดทโดย: ${updaterName}\n`;
                        } catch (e) {
                            message += `• อัพเดทโดย: UID: ${admin.updatedBy}\n`;
                        }
                    }
                }

                message += `\n✅ สิทธิ์ที่มี:\n`;
                message += `• เพิ่มแอดมินได้ (สูงสุด 30 วัน)\n`;
                message += `• เตะผู้ใช้ได้ (เหลือ ${maxKicks - admin.kickCount} ครั้ง)\n`;
                message += `• ดูรายชื่อแอดมินได้\n`;
                message += `• ใช้คำสั่งแอดมินอื่นๆ ได้\n`;

                // แสดงคำเตือนตามสถานการณ์
                const warningThreshold = Math.ceil(maxKicks * 0.7); // เตือนเมื่อใช้ไป 70%
                if (admin.kickCount >= warningThreshold) {
                    message += `\n⚠️ คำเตือน:\n`;
                    message += `• ใช้สิทธิ์เตะไปแล้ว ${admin.kickCount}/${maxKicks} ครั้ง\n`;
                    message += `• หากเตะครบ ${maxKicks} ครั้ง จะถูกลบออกทันที\n`;
                    message += `• แนะนำให้ใช้สิทธิ์อย่างระมัดระวัง\n`;
                }

                if (timeLeft <= 24 * 60 * 60 * 1000) { // น้อยกว่า 24 ชั่วโมง
                    message += `\n🔔 แจ้งเตือนเวลา:\n`;
                    message += `• สิทธิ์จะหมดอายุในอีก ${hoursLeft}ชม ${minutesLeft}นาที\n`;
                    message += `• ติดต่อผู้ดูแลสูงสุดหากต้องการต่ออายุ\n`;
                }
            }
            else {
                // ตรวจสอบในประวัติ
                const history = detailedData.adminHistory.find(h => h.adminId === targetID);
                
                message += `👤 สถานะ: ผู้ใช้ทั่วไป\n`;
                message += `🔒 สิทธิ์: พื้นฐาน\n`;
                message += `⏰ ระยะเวลา: ไม่มีข้อจำกัด\n`;
                message += `🚫 การเตะ: ไม่สามารถเตะได้\n\n`;
                
                if (history) {
                    message += `📋 ประวัติการเป็นแอดมิน:\n`;
                    message += `• เคยเป็นแอดมินมาแล้ว\n`;
                    message += `• ระยะเวลาที่เคยใช้: ${history.duration}\n`;
                    message += `• การเตะที่เคยใช้: ${history.kickCount}/${history.maxKicks || 5} ครั้ง\n`;
                    message += `• ลบออกเมื่อ: ${new Date(history.removedAt).toLocaleString('th-TH')}\n`;
                    message += `• สาเหตุ: ${history.removedReason}\n\n`;
                }
                
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
            console.error('Admin info command error:', error);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการดูข้อมูลแอดมิน\n` +
                `🔧 Error: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
