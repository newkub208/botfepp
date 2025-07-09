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
    name: "เปรียบเทียบแอดมิน",
    description: "เปรียบเทียบจำนวนการเตะและสถานะของแอดมินทั้งหมด",
    version: "1.0.0",
    aliases: ["compareadmin", "เทียบแอดมิน", "อันดับแอดมิน"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;

        // ตรวจสอบสิทธิ์ผู้ใช้งาน
        if (!hasPermission(senderID)) {
            return api.sendMessage("❌ คำสั่งนี้สำหรับแอดมินเท่านั้น", threadID, messageID);
        }

        try {
            const detailedData = loadDetailedAdmins();
            const now = new Date();

            // รวบรวมข้อมูลแอดมินที่ใช้งานอยู่
            const activeAdmins = [];
            for (const adminId in detailedData.temporaryAdmins) {
                const admin = detailedData.temporaryAdmins[adminId];
                if (admin.isActive && new Date(admin.expiresAt) > now) {
                    activeAdmins.push({
                        adminId,
                        ...admin,
                        maxKicks: admin.maxKicks || 5,
                        remainingKicks: (admin.maxKicks || 5) - admin.kickCount,
                        usagePercent: ((admin.kickCount / (admin.maxKicks || 5)) * 100),
                        daysLeft: Math.ceil((new Date(admin.expiresAt) - now) / (1000 * 60 * 60 * 24))
                    });
                }
            }

            if (activeAdmins.length === 0) {
                return api.sendMessage(
                    `ℹ️ ไม่มีแอดมินชั่วคราวที่ใช้งานอยู่\n\n` +
                    `💡 ใช้คำสั่ง ${prefix}เพิ่มแอดมิน เพื่อเพิ่มแอดมินใหม่`,
                    threadID,
                    messageID
                );
            }

            let message = `📊 เปรียบเทียบแอดมินทั้งหมด\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            // สถิติรวม
            const totalMaxKicks = activeAdmins.reduce((sum, admin) => sum + admin.maxKicks, 0);
            const totalUsedKicks = activeAdmins.reduce((sum, admin) => sum + admin.kickCount, 0);
            const totalRemainingKicks = activeAdmins.reduce((sum, admin) => sum + admin.remainingKicks, 0);
            const avgUsagePercent = activeAdmins.reduce((sum, admin) => sum + admin.usagePercent, 0) / activeAdmins.length;

            message += `📈 สถิติรวม:\n`;
            message += `• แอดมินทั้งหมด: ${activeAdmins.length} คน\n`;
            message += `• การเตะรวมที่กำหนด: ${totalMaxKicks} ครั้ง\n`;
            message += `• การเตะที่ใช้ไปแล้ว: ${totalUsedKicks} ครั้ง\n`;
            message += `• การเตะที่เหลือ: ${totalRemainingKicks} ครั้ง\n`;
            message += `• อัตราการใช้งานเฉลี่ย: ${avgUsagePercent.toFixed(1)}%\n\n`;

            // จัดเรียงตามประเภทการแสดงผล
            const sortType = args[0]?.toLowerCase() || "kicks";

            if (sortType === "time" || sortType === "เวลา") {
                message += `⏰ จัดเรียงตามเวลาที่เหลือ (น้อย → มาก):\n`;
                activeAdmins.sort((a, b) => a.daysLeft - b.daysLeft);
            } else if (sortType === "usage" || sortType === "ใช้งาน") {
                message += `📊 จัดเรียงตามอัตราการใช้งาน (มาก → น้อย):\n`;
                activeAdmins.sort((a, b) => b.usagePercent - a.usagePercent);
            } else {
                message += `🚫 จัดเรียงตามจำนวนการเตะ (มาก → น้อย):\n`;
                activeAdmins.sort((a, b) => b.maxKicks - a.maxKicks);
            }

            // แสดงรายละเอียดแต่ละคน
            for (let i = 0; i < activeAdmins.length; i++) {
                const admin = activeAdmins[i];
                
                // ดึงชื่อผู้ใช้
                let userName = `UID: ${admin.adminId}`;
                try {
                    const userInfo = await api.getUserInfo(admin.adminId);
                    userName = userInfo[admin.adminId]?.name || userName;
                } catch (e) {
                    // ใช้ค่าเริ่มต้น
                }

                // กำหนดอีโมจิตามอันดับ
                let rankEmoji = "";
                if (i === 0) rankEmoji = "🥇";
                else if (i === 1) rankEmoji = "🥈";
                else if (i === 2) rankEmoji = "🥉";
                else rankEmoji = `${i + 1}.`;

                // กำหนดสีตามสถานะ
                let statusEmoji = "";
                if (admin.usagePercent >= 80) statusEmoji = "🔴"; // อันตราย
                else if (admin.usagePercent >= 60) statusEmoji = "🟡"; // เตือน
                else statusEmoji = "🟢"; // ปกติ

                message += `${rankEmoji} ${statusEmoji} ${userName}\n`;
                message += `   └── เตะ: ${admin.kickCount}/${admin.maxKicks} (${admin.usagePercent.toFixed(1)}%)\n`;
                message += `   └── เหลือ: ${admin.remainingKicks} ครั้ง | ${admin.daysLeft} วัน\n`;
                
                // แสดงข้อมูลเพิ่มเติมสำหรับคนที่ใกล้หมดสิทธิ์
                if (admin.usagePercent >= 80 || admin.daysLeft <= 1) {
                    message += `   └── ⚠️ `;
                    if (admin.usagePercent >= 80) message += `ใช้สิทธิ์เกือบหมด `;
                    if (admin.daysLeft <= 1) message += `เวลาใกล้หมด`;
                    message += `\n`;
                }
                
                message += `\n`;
            }

            // สรุปคำแนะนำ
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `💡 คำแนะนำ:\n`;

            // หาคนที่ใช้สิทธิ์เกือบหมด
            const highUsageAdmins = activeAdmins.filter(admin => admin.usagePercent >= 70);
            if (highUsageAdmins.length > 0) {
                message += `• มีแอดมิน ${highUsageAdmins.length} คนใช้สิทธิ์เกือบหมด\n`;
            }

            // หาคนที่เวลาใกล้หมด
            const lowTimeAdmins = activeAdmins.filter(admin => admin.daysLeft <= 3);
            if (lowTimeAdmins.length > 0) {
                message += `• มีแอดมิน ${lowTimeAdmins.length} คนที่เวลาใกล้หมด\n`;
            }

            // หาคนที่มีสิทธิ์เตะแตกต่างกันมาก
            const maxKicksValues = activeAdmins.map(admin => admin.maxKicks);
            const minMaxKicks = Math.min(...maxKicksValues);
            const maxMaxKicks = Math.max(...maxKicksValues);
            
            if (maxMaxKicks - minMaxKicks > 5) {
                message += `• จำนวนการเตะแตกต่างกันมาก (${minMaxKicks}-${maxMaxKicks} ครั้ง)\n`;
            }

            message += `\n📝 วิธีใช้:\n`;
            message += `• ${prefix}เปรียบเทียบแอดมิน - จัดเรียงตามจำนวนการเตะ\n`;
            message += `• ${prefix}เปรียบเทียบแอดมิน เวลา - จัดเรียงตามเวลาที่เหลือ\n`;
            message += `• ${prefix}เปรียบเทียบแอดมิน ใช้งาน - จัดเรียงตามอัตราการใช้งาน\n\n`;
            message += `📅 อัพเดทเมื่อ: ${new Date().toLocaleString('th-TH')}`;

            api.sendMessage(message, threadID, messageID);

        } catch (error) {
            console.error('Compare admin command error:', error);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการเปรียบเทียบแอดมิน\n` +
                `🔧 Error: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
