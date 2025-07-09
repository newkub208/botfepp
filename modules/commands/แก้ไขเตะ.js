const { loadDetailedAdmins, saveDetailedAdmins } = require('../../utils/adminManager');
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
    name: "แก้ไขเตะ",
    description: "แก้ไขจำนวนการเตะของแอดมินที่มีอยู่แล้ว",
    version: "1.0.0",
    aliases: ["editkicks", "แก้เตะ", "เปลี่ยนเตะ", "edit-kicks", "modify-kicks", "changekicks"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, type, messageReply } = event;

        // ตรวจสอบสิทธิ์ (เฉพาะ Super Admin เท่านั้น)
        if (senderID !== SUPER_ADMIN_ID) {
            return api.sendMessage("❌ คำสั่งนี้สำหรับผู้ดูแลสูงสุดเท่านั้น", threadID, messageID);
        }

        try {
            const detailedData = loadDetailedAdmins();

            // หาเป้าหมายและจำนวนการเตะใหม่
            let targetID = "";
            let newMaxKicks = 0;

            if (type === "message_reply") {
                targetID = messageReply.senderID;
                if (args.length > 0 && /^\d+$/.test(args[0])) {
                    newMaxKicks = parseInt(args[0]);
                } else {
                    return api.sendMessage(
                        `📝 วิธีใช้เมื่อตอบกลับข้อความ:\n` +
                        `${prefix}แก้ไขเตะ [จำนวนเตะใหม่]\n\n` +
                        `🔍 ตัวอย่าง:\n` +
                        `${prefix}แก้ไขเตะ 15`,
                        threadID,
                        messageID
                    );
                }
            } else if (args.length >= 2 && /^\d+$/.test(args[0]) && /^\d+$/.test(args[1])) {
                targetID = args[0];
                newMaxKicks = parseInt(args[1]);
            } else {
                return api.sendMessage(
                    `📝 วิธีใช้คำสั่ง:\n` +
                    `• ตอบกลับข้อความแล้วพิมพ์ ${prefix}แก้ไขเตะ [จำนวนเตะใหม่]\n` +
                    `• พิมพ์ ${prefix}แก้ไขเตะ [UID] [จำนวนเตะใหม่]\n\n` +
                    `🔍 ตัวอย่าง:\n` +
                    `${prefix}แก้ไขเตะ 61574221880222 20\n` +
                    `${prefix}แก้ไขเตะ 61574221880222 3\n\n` +
                    `📊 ช่วงที่อนุญาต: 1-100 ครั้ง`,
                    threadID,
                    messageID
                );
            }

            // ตรวจสอบจำนวนการเตะ
            if (newMaxKicks < 1 || newMaxKicks > 100) {
                return api.sendMessage(
                    `❌ จำนวนการเตะต้องอยู่ระหว่าง 1-100\n` +
                    `📊 คุณใส่: ${newMaxKicks}`,
                    threadID,
                    messageID
                );
            }

            // ตรวจสอบว่าเป้าหมายเป็น Super Admin หรือไม่
            if (targetID === SUPER_ADMIN_ID) {
                return api.sendMessage("❌ ไม่สามารถแก้ไขผู้ดูแลสูงสุดได้", threadID, messageID);
            }

            // ตรวจสอบว่าเป้าหมายเป็นแอดมินหรือไม่
            if (!detailedData.temporaryAdmins[targetID] || 
                !detailedData.temporaryAdmins[targetID].isActive ||
                new Date(detailedData.temporaryAdmins[targetID].expiresAt) <= new Date()) {
                
                return api.sendMessage(
                    `ℹ️ ผู้ใช้ UID: ${targetID} ไม่ได้เป็นแอดมินที่ใช้งานอยู่\n\n` +
                    `💡 ตรวจสอบรายชื่อแอดมินด้วยคำสั่ง: ${prefix}รายชื่อแอดมิน`,
                    threadID,
                    messageID
                );
            }

            const admin = detailedData.temporaryAdmins[targetID];
            const oldMaxKicks = admin.maxKicks || 5;
            const currentKicks = admin.kickCount || 0;

            // ตรวจสอบว่าจำนวนการเตะใหม่ต้องมากกว่าหรือเท่ากับการเตะที่ใช้ไปแล้ว
            if (newMaxKicks < currentKicks) {
                return api.sendMessage(
                    `❌ จำนวนการเตะใหม่ต้องมากกว่าหรือเท่ากับการเตะที่ใช้ไปแล้ว\n\n` +
                    `📊 การเตะที่ใช้ไปแล้ว: ${currentKicks} ครั้ง\n` +
                    `📊 จำนวนใหม่ที่คุณใส่: ${newMaxKicks} ครั้ง\n` +
                    `✅ จำนวนขั้นต่ำที่อนุญาต: ${currentKicks} ครั้ง`,
                    threadID,
                    messageID
                );
            }

            // อัพเดทจำนวนการเตะ
            admin.maxKicks = newMaxKicks;
            admin.lastUpdated = new Date().toISOString();
            admin.updatedBy = senderID;

            saveDetailedAdmins(detailedData);

            // ดึงชื่อผู้ใช้เพื่อแสดงในข้อความตอบกลับ
            let targetName = `ผู้ใช้ UID: ${targetID}`;
            try {
                const userInfo = await api.getUserInfo(targetID);
                targetName = userInfo[targetID]?.name || targetName;
            } catch (e) {
                // ใช้ค่าเริ่มต้น
            }

            const expiresAt = new Date(admin.expiresAt);
            const now = new Date();
            const timeLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

            let message = `✅ แก้ไขจำนวนการเตะของ "${targetName}" เรียบร้อยแล้ว\n\n`;
            message += `📊 การเปลี่ยนแปลง:\n`;
            message += `• จำนวนเดิม: ${oldMaxKicks} ครั้ง\n`;
            message += `• จำนวนใหม่: ${newMaxKicks} ครั้ง\n`;
            message += `• การเปลี่ยนแปลง: ${newMaxKicks > oldMaxKicks ? '+' : ''}${newMaxKicks - oldMaxKicks} ครั้ง\n\n`;

            message += `📋 สถานะปัจจุบัน:\n`;
            message += `• การเตะที่ใช้ไป: ${currentKicks}/${newMaxKicks} ครั้ง\n`;
            message += `• การเตะที่เหลือ: ${newMaxKicks - currentKicks} ครั้ง\n`;
            message += `• เวลาที่เหลือ: ${timeLeft} วัน\n`;
            message += `• หมดอายุ: ${expiresAt.toLocaleString('th-TH')}\n\n`;

            if (newMaxKicks > oldMaxKicks) {
                message += `🎉 ผลกระทบ:\n`;
                message += `• แอดมินคนนี้มีสิทธิ์เตะเพิ่มขึ้น ${newMaxKicks - oldMaxKicks} ครั้ง\n`;
                message += `• สามารถใช้งานต่อได้จนหมดเวลา\n`;
            } else if (newMaxKicks < oldMaxKicks) {
                message += `⚠️ ผลกระทบ:\n`;
                message += `• แอดมินคนนี้มีสิทธิ์เตะลดลง ${oldMaxKicks - newMaxKicks} ครั้ง\n`;
                if (currentKicks === newMaxKicks) {
                    message += `• ไม่สามารถเตะเพิ่มได้แล้ว\n`;
                }
            } else {
                message += `ℹ️ ไม่มีการเปลี่ยนแปลง`;
            }

            message += `\n📅 แก้ไขเมื่อ: ${new Date().toLocaleString('th-TH')}`;

            api.sendMessage(message, threadID, messageID);

        } catch (error) {
            console.error('Edit kicks command error:', error);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการแก้ไขจำนวนการเตะ\n` +
                `🔧 Error: ${error.message}`,
                threadID,
                messageID
            );
        }
    }
};
