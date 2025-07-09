const fs = require('fs');
const path = require('path');
const { loadDetailedAdmins } = require('../../utils/adminManager');

// --- กำหนดค่าคงที่ ---
const SUPER_ADMIN_ID = '61555184860915';
const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json');

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

// --- ฟังก์ชันตรวจสอบสิทธิ์ ---
function hasPermission(senderID) {
    const admins = loadAdmins();
    return senderID === SUPER_ADMIN_ID || admins.includes(senderID);
}

module.exports = {
    name: "รายชื่อแอดมิน",
    description: "แสดงรายชื่อแอดมินทั้งหมดของบอท",
    version: "2.0.0",
    aliases: ["adminlist", "listadmin", "แอดมิน", "admin-list", "list-admin", "admins"],
    nashPrefix: false,
    cooldowns: 2,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;

        // --- ตรวจสอบสิทธิ์ผู้ใช้งาน ---
        if (!hasPermission(senderID)) {
            return api.sendMessage("❌ คำสั่งนี้สำหรับแอดมินเท่านั้น", threadID, messageID);
        }

        try {
            const detailedData = loadDetailedAdmins();
            const now = new Date();
            
            let message = `👥 รายชื่อแอดมินของบอท\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            // แสดงผู้ดูแลสูงสุด
            message += `👑 ผู้ดูแลสูงสุด:\n`;
            try {
                const superAdminInfo = await api.getUserInfo(SUPER_ADMIN_ID);
                const superAdminName = superAdminInfo[SUPER_ADMIN_ID]?.name || "ไม่ทราบชื่อ";
                message += `• ${superAdminName} (${SUPER_ADMIN_ID})\n`;
                message += `  └── สิทธิ์: ไม่จำกัด | ไม่หมดอายุ\n\n`;
            } catch (e) {
                message += `• UID: ${SUPER_ADMIN_ID}\n`;
                message += `  └── สิทธิ์: ไม่จำกัด | ไม่หมดอายุ\n\n`;
            }

            // แสดงแอดมินชั่วคราว
            const activeAdmins = Object.keys(detailedData.temporaryAdmins).filter(id => {
                const admin = detailedData.temporaryAdmins[id];
                return admin.isActive && new Date(admin.expiresAt) > now;
            });

            if (activeAdmins.length > 0) {
                // จัดเรียงแอดมินตามจำนวนการเตะที่กำหนด (มาก → น้อย)
                const sortedAdmins = activeAdmins.map(id => ({
                    id,
                    admin: detailedData.temporaryAdmins[id],
                    maxKicks: detailedData.temporaryAdmins[id].maxKicks || 5
                })).sort((a, b) => b.maxKicks - a.maxKicks);

                message += `🛡️ แอดมินชั่วคราว (${activeAdmins.length} คน):\n`;
                
                for (let i = 0; i < sortedAdmins.length; i++) {
                    const { id: adminID, admin, maxKicks } = sortedAdmins[i];
                    
                    try {
                        const userInfo = await api.getUserInfo(adminID);
                        const userName = userInfo[adminID]?.name || "ไม่ทราบชื่อ";
                        
                        const expiresAt = new Date(admin.expiresAt);
                        const timeLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
                        
                        // เพิ่มอีโมจิแสดงสถานะ
                        let statusEmoji = "";
                        const usagePercent = (admin.kickCount / maxKicks) * 100;
                        if (usagePercent >= 80) statusEmoji = "🔴"; // อันตราย
                        else if (usagePercent >= 60) statusEmoji = "🟡"; // เตือน
                        else statusEmoji = "🟢"; // ปกติ
                        
                        message += `${i + 1}. ${statusEmoji} ${userName} (${adminID})\n`;
                        message += `   └── เตะ: ${admin.kickCount}/${maxKicks} (${usagePercent.toFixed(1)}%) | `;
                        message += `เหลือ: ${timeLeft} วัน | `;
                        message += `หมดอายุ: ${expiresAt.toLocaleString('th-TH', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}\n`;
                        
                        // แสดงคำเตือนสำหรับคนที่ใช้สิทธิ์เกือบหมดหรือเวลาใกล้หมด
                        if (usagePercent >= 80 || timeLeft <= 1) {
                            message += `   └── ⚠️ `;
                            if (usagePercent >= 80) message += `สิทธิ์เกือบหมด `;
                            if (timeLeft <= 1) message += `เวลาใกล้หมด`;
                            message += `\n`;
                        }
                    } catch (e) {
                        message += `${i + 1}. UID: ${adminID}\n`;
                        message += `   └── เตะ: ${admin.kickCount}/${maxKicks} | `;
                        message += `หมดอายุ: ${new Date(admin.expiresAt).toLocaleString('th-TH')}\n`;
                    }
                }
            } else {
                message += `🛡️ แอดมินชั่วคราว: ไม่มี\n`;
            }

            // แสดงประวัติแอดมินที่ถูกลบ (5 คนล่าสุด)
            if (detailedData.adminHistory.length > 0) {
                message += `\n📋 ประวัติล่าสุด (${Math.min(detailedData.adminHistory.length, 5)} คน):\n`;
                
                const recentHistory = detailedData.adminHistory.slice(-5).reverse();
                for (let i = 0; i < recentHistory.length; i++) {
                    const history = recentHistory[i];
                    try {
                        const userInfo = await api.getUserInfo(history.adminId);
                        const userName = userInfo[history.adminId]?.name || "ไม่ทราบชื่อ";
                        message += `${i + 1}. ${userName} - ${history.removedReason}\n`;
                    } catch (e) {
                        message += `${i + 1}. UID: ${history.adminId} - ${history.removedReason}\n`;
                    }
                }
            }

            message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `📊 สรุป:\n`;
            message += `• ผู้ดูแลสูงสุด: 1 คน\n`;
            message += `• แอดมินชั่วคราว: ${activeAdmins.length} คน\n`;
            message += `• รวมทั้งหมด: ${activeAdmins.length + 1} คน\n`;
            message += `• ประวัติทั้งหมด: ${detailedData.adminHistory.length} คน\n\n`;
            message += `📅 ตรวจสอบเมื่อ: ${new Date().toLocaleString('th-TH')}`;

            api.sendMessage(message, threadID, messageID);

        } catch (error) {
            console.error('Admin list command error:', error);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการแสดงรายชื่อแอดมิน\n` +
                `🔧 Error: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
