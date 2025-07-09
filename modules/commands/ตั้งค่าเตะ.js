const { loadDetailedAdmins, saveDetailedAdmins } = require('../../utils/adminManager');

// --- กำหนดค่าคงที่ ---
const SUPER_ADMIN_ID = '61555184860915';

module.exports = {
    name: "ตั้งค่าเตะ",
    description: "ตั้งค่าจำนวนการเตะเริ่มต้นสำหรับแอดมินใหม่",
    version: "1.0.0",
    aliases: ["setkicks", "ตั้งเตะ", "กำหนดเตะ", "set-kicks", "default-kicks", "kicksetting"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;

        // ตรวจสอบสิทธิ์ (เฉพาะ Super Admin เท่านั้น)
        if (senderID !== SUPER_ADMIN_ID) {
            return api.sendMessage("❌ คำสั่งนี้สำหรับผู้ดูแลสูงสุดเท่านั้น", threadID, messageID);
        }

        try {
            const detailedData = loadDetailedAdmins();

            // ถ้าไม่มี args แสดงค่าปัจจุบัน
            if (args.length === 0) {
                const currentDefault = detailedData.defaultMaxKicks || 5;
                
                let message = `⚙️ การตั้งค่าจำนวนการเตะ\n`;
                message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
                message += `📊 ค่าปัจจุบัน:\n`;
                message += `• จำนวนการเตะเริ่มต้น: ${currentDefault} ครั้ง\n\n`;
                message += `📝 วิธีใช้:\n`;
                message += `• ${prefix}ตั้งค่าเตะ [จำนวน] - เปลี่ยนค่าเริ่มต้น\n`;
                message += `• ${prefix}ตั้งค่าเตะ - ดูค่าปัจจุบัน\n\n`;
                message += `🔍 ตัวอย่าง:\n`;
                message += `${prefix}ตั้งค่าเตะ 10\n`;
                message += `${prefix}ตั้งค่าเตะ 3\n\n`;
                message += `⚠️ หมายเหตุ:\n`;
                message += `• ค่าที่ตั้งจะใช้กับแอดมินใหม่เท่านั้น\n`;
                message += `• แอดมินเก่าจะใช้ค่าที่ตั้งไว้แล้ว\n`;
                message += `• ช่วงที่อนุญาต: 1-100 ครั้ง`;

                return api.sendMessage(message, threadID, messageID);
            }

            // ตั้งค่าใหม่
            const newMaxKicks = parseInt(args[0]);

            // ตรวจสอบความถูกต้อง
            if (isNaN(newMaxKicks) || newMaxKicks < 1 || newMaxKicks > 100) {
                return api.sendMessage(
                    `❌ จำนวนการเตะต้องเป็นตัวเลข 1-100\n` +
                    `📊 คุณใส่: ${args[0]}`,
                    threadID,
                    messageID
                );
            }

            // อัพเดทค่าเริ่มต้น
            const oldDefault = detailedData.defaultMaxKicks || 5;
            detailedData.defaultMaxKicks = newMaxKicks;
            detailedData.lastUpdated = new Date().toISOString();
            detailedData.updatedBy = senderID;

            saveDetailedAdmins(detailedData);

            let message = `✅ ตั้งค่าจำนวนการเตะเริ่มต้นเรียบร้อยแล้ว\n\n`;
            message += `📊 การเปลี่ยนแปลง:\n`;
            message += `• ค่าเดิม: ${oldDefault} ครั้ง\n`;
            message += `• ค่าใหม่: ${newMaxKicks} ครั้ง\n\n`;
            message += `🎯 ผลกระทบ:\n`;
            message += `• แอดมินใหม่จะได้รับสิทธิ์เตะ ${newMaxKicks} ครั้ง\n`;
            message += `• แอดมินเก่าไม่ได้รับผลกระทบ\n`;
            message += `• สามารถกำหนดเฉพาะแต่ละคนได้เมื่อเพิ่มแอดมิน\n\n`;
            message += `📅 อัพเดทเมื่อ: ${new Date().toLocaleString('th-TH')}`;

            api.sendMessage(message, threadID, messageID);

        } catch (error) {
            console.error('Set kicks command error:', error);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการตั้งค่า\n` +
                `🔧 Error: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
