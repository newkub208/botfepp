const fs = require('fs');
const path = require('path');

// --- กำหนดค่าคงที่ ---
const SUPER_ADMIN_ID = '61555184860915'; // ไอดีของผู้ใช้ที่มีสิทธิ์สูงสุด
const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json'); // ที่อยู่ของไฟล์เก็บรายชื่อแอดมิน

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
    // ถ้าไม่มีไฟล์หรือไฟล์เสียหาย ให้คืนค่าเป็น array ว่าง
    return [];
}

// --- ฟังก์ชันสำหรับบันทึกรายชื่อแอดมิน ---
function saveAdmins(admins) {
    try {
        fs.writeFileSync(ADMIN_FILE_PATH, JSON.stringify(admins, null, 2));
    } catch (error) {
        console.error('Error saving admin list:', error);
    }
}

module.exports = {
    name: "ลบแอดมิน",
    description: "ลบผู้ใช้ออกจากรายชื่อแอดมินของบอท (สำหรับผู้ดูแลสูงสุดเท่านั้น)",
    version: "1.0.0",
    aliases: ["removeadmin", "deladmin", "เอาออกจากแอดมิน", "delete-admin", "remove-admin", "unadmin"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, type, messageReply } = event;

        // --- 1. ตรวจสอบสิทธิ์ผู้ใช้งาน ---
        if (senderID !== SUPER_ADMIN_ID) {
            return api.sendMessage("❌ คำสั่งนี้สำหรับผู้ดูแลสูงสุดเท่านั้น", threadID, messageID);
        }

        // --- 2. หาเป้าหมายที่จะลบออกจากแอดมิน ---
        let targetID = "";
        if (type === "message_reply") {
            targetID = messageReply.senderID;
        } else if (args.length > 0 && /^\d+$/.test(args[0])) {
            targetID = args[0];
        } else {
            return api.sendMessage(
                `📝 วิธีใช้คำสั่ง:\n` +
                `• ตอบกลับข้อความแล้วพิมพ์ ${prefix}ลบแอดมิน\n` +
                `• พิมพ์ ${prefix}ลบแอดมิน [UID ของผู้ใช้]\n\n` +
                `🔍 ตัวอย่าง:\n` +
                `${prefix}ลบแอดมิน 61574221880222`,
                threadID,
                messageID
            );
        }
        
        // --- 3. จัดการข้อมูลแอดมิน ---
        try {
            const admins = loadAdmins();

            // ตรวจสอบว่าเป้าหมายเป็น Super Admin หรือไม่
            if (targetID === SUPER_ADMIN_ID) {
                return api.sendMessage("❌ ไม่สามารถลบผู้ดูแลสูงสุดออกจากระบบได้", threadID, messageID);
            }

            // ตรวจสอบว่าเป้าหมายเป็นแอดมินหรือไม่
            const adminIndex = admins.indexOf(targetID);
            if (adminIndex === -1) {
                return api.sendMessage(
                    `ℹ️ ผู้ใช้ UID: ${targetID} ไม่ได้เป็นแอดมินของบอทอยู่แล้ว\n\n` +
                    `📋 รายชื่อแอดมินปัจจุบัน: ${admins.length} คน`,
                    threadID,
                    messageID
                );
            }

            // ลบแอดมินออกจากรายชื่อ
            admins.splice(adminIndex, 1);
            saveAdmins(admins);

            // ดึงชื่อผู้ใช้เพื่อแสดงในข้อความตอบกลับ
            let targetName = `ผู้ใช้ UID: ${targetID}`;
            try {
                const userInfo = await api.getUserInfo(targetID);
                targetName = userInfo[targetID]?.name || targetName;
            } catch (e) {
                // ใช้ค่าเริ่มต้นถ้าดึงข้อมูลไม่ได้
            }

            api.sendMessage(
                `✅ ลบ "${targetName}" ออกจากรายชื่อแอดมินเรียบร้อยแล้ว\n\n` +
                `📊 สถิติ:\n` +
                `• แอดมินที่เหลือ: ${admins.length} คน\n` +
                `• ลบเมื่อ: ${new Date().toLocaleString('th-TH')}\n\n` +
                `⚠️ หมายเหตุ: ผู้ใช้คนนี้จะไม่สามารถใช้คำสั่งแอดมินได้อีกต่อไป`,
                threadID,
                messageID
            );

        } catch (err) {
            console.error("Remove admin command error:", err);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการลบแอดมิน\n` +
                `🔧 Error: ${err.message}`,
                threadID,
                messageID
            );
        }
    }
};
