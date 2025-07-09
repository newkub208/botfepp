const { getAdminStatistics, getAdminsNearExpiry, cleanupExpiredAdmins } = require('../../utils/adminCleanup');
const { loadDetailedAdmins } = require('../../utils/adminManager');

// --- กำหนดค่าคงที่ ---
const SUPER_ADMIN_ID = '61555184860915';

module.exports = {
    name: "สถิติแอดมิน",
    description: "แสดงสถิติและข้อมูลการจัดการแอดมิน",
    version: "1.0.0",
    aliases: ["adminstats", "admininfo", "สถิติ", "admin-stats", "admin-info", "statistics"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;

        // ตรวจสอบสิทธิ์ (เฉพาะ Super Admin เท่านั้น)
        if (senderID !== SUPER_ADMIN_ID) {
            return api.sendMessage("❌ คำสั่งนี้สำหรับผู้ดูแลสูงสุดเท่านั้น", threadID, messageID);
        }

        try {
            // ทำความสะอาดก่อนแสดงสถิติ
            const cleanupResults = cleanupExpiredAdmins();
            const stats = getAdminStatistics();
            
            if (!stats) {
                return api.sendMessage("❌ ไม่สามารถโหลดข้อมูลสถิติได้", threadID, messageID);
            }

            let message = `📊 สถิติการจัดการแอดมิน\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            // สถิติปัจจุบัน
            message += `📈 สถิติปัจจุบัน:\n`;
            message += `• แอดมินที่ใช้งานอยู่: ${stats.active} คน\n`;
            message += `• แอดมินที่ใกล้หมดอายุ: ${stats.nearExpiry.length} คน\n\n`;

            // สถิติประวัติศาสตร์
            message += `📋 ประวัติทั้งหมด:\n`;
            message += `• ถูกลบเพราะหมดอายุ: ${stats.expired} คน\n`;
            message += `• ถูกลบเพราะเตะครบ: ${stats.kickedOut} คน\n`;
            message += `• รวมประวัติทั้งหมด: ${stats.totalHistory} คน\n\n`;

            // แอดมินที่ใช้งานอยู่
            if (stats.active > 0) {
                message += `👥 แอดมินที่ใช้งานอยู่:\n`;
                for (let i = 0; i < Math.min(stats.activeAdmins.length, 5); i++) {
                    const admin = stats.activeAdmins[i];
                    const maxKicks = admin.maxKicks || 5; // ใช้ค่าเริ่มต้น 5 ถ้าไม่มีการกำหนด
                    const expiresAt = new Date(admin.expiresAt);
                    const hoursLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60));
                    
                    try {
                        const userInfo = await api.getUserInfo(admin.adminId);
                        const userName = userInfo[admin.adminId]?.name || "ไม่ทราบชื่อ";
                        message += `${i + 1}. ${userName}\n`;
                        message += `   └── เตะ: ${admin.kickCount}/${maxKicks} | เหลือ: ${hoursLeft}ชม\n`;
                    } catch (e) {
                        message += `${i + 1}. UID: ${admin.adminId}\n`;
                        message += `   └── เตะ: ${admin.kickCount}/${maxKicks} | เหลือ: ${hoursLeft}ชม\n`;
                    }
                }
                if (stats.activeAdmins.length > 5) {
                    message += `... และอีก ${stats.activeAdmins.length - 5} คน\n`;
                }
                message += `\n`;
            }

            // แอดมินที่ใกล้หมดอายุ
            if (stats.nearExpiry.length > 0) {
                message += `⚠️ แอดมินที่ใกล้หมดอายุ (ใน 24ชม):\n`;
                for (let i = 0; i < Math.min(stats.nearExpiry.length, 3); i++) {
                    const nearExpiry = stats.nearExpiry[i];
                    try {
                        const userInfo = await api.getUserInfo(nearExpiry.adminId);
                        const userName = userInfo[nearExpiry.adminId]?.name || "ไม่ทราบชื่อ";
                        message += `${i + 1}. ${userName} - เหลือ ${nearExpiry.hoursLeft} ชั่วโมง\n`;
                    } catch (e) {
                        message += `${i + 1}. UID: ${nearExpiry.adminId} - เหลือ ${nearExpiry.hoursLeft} ชั่วโมง\n`;
                    }
                }
                if (stats.nearExpiry.length > 3) {
                    message += `... และอีก ${stats.nearExpiry.length - 3} คน\n`;
                }
                message += `\n`;
            }

            // ผลการทำความสะอาดล่าสุด
            if (cleanupResults.expired.length > 0 || cleanupResults.maxKicks.length > 0) {
                message += `🧹 การทำความสะอาดล่าสุด:\n`;
                if (cleanupResults.expired.length > 0) {
                    message += `• ลบเพราะหมดอายุ: ${cleanupResults.expired.length} คน\n`;
                }
                if (cleanupResults.maxKicks.length > 0) {
                    message += `• ลบเพราะเตะครบ: ${cleanupResults.maxKicks.length} คน\n`;
                }
                message += `\n`;
            }

            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `🎯 อัตราความสำเร็จ:\n`;
            const successRate = stats.totalHistory > 0 
                ? ((stats.expired / stats.totalHistory) * 100).toFixed(1)
                : "0.0";
            message += `• แอดมินที่หมดอายุปกติ: ${successRate}%\n`;
            message += `• แอดมินที่ถูกลบเพราะเตะครบ: ${(100 - parseFloat(successRate)).toFixed(1)}%\n\n`;
            message += `📅 อัพเดทเมื่อ: ${new Date().toLocaleString('th-TH')}`;

            api.sendMessage(message, threadID, messageID);

        } catch (error) {
            console.error('Admin stats command error:', error);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการแสดงสถิติ\n` +
                `🔧 Error: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
