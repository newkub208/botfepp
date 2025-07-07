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
    name: "เพิ่มแอดมิน",
    description: "เพิ่มผู้ใช้เป็นแอดมินของบอท (สำหรับผู้ดูแลสูงสุดเท่านั้น)",
    version: "1.0.0",
    aliases: ["addadmin", "setadmin"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, type, messageReply } = event;

        // --- 1. ตรวจสอบสิทธิ์ผู้ใช้งาน ---
        if (senderID !== SUPER_ADMIN_ID) {
            return api.sendMessage("คำสั่งนี้สำหรับผู้ดูแลสูงสุดเท่านั้นครับ", threadID, messageID);
        }

        // --- 2. หาเป้าหมายที่จะแต่งตั้ง ---
        let targetID = "";
        if (type === "message_reply") {
            targetID = messageReply.senderID;
        } else if (args.length > 0 && /^\d+$/.test(args[0])) {
            targetID = args[0];
        } else {
            return api.sendMessage(
                `วิธีใช้คำสั่ง:\n` +
                `• ตอบกลับข้อความแล้วพิมพ์ ${prefix}เพิ่มแอดมิน\n` +
                `• พิมพ์ ${prefix}เพิ่มแอดมิน [UID ของผู้ใช้]`,
                threadID,
                messageID
            );
        }
        
        // --- 3. จัดการข้อมูลแอดมิน ---
        try {
            const admins = loadAdmins();

            // ตรวจสอบว่าเป้าหมายเป็นแอดมินอยู่แล้วหรือไม่
            if (admins.includes(targetID)) {
                return api.sendMessage(`ผู้ใช้ UID: ${targetID} เป็นแอดมินของบอทอยู่แล้ว`, threadID, messageID);
            }
            
            // ตรวจสอบว่าเป้าหมายเป็น Super Admin หรือไม่
            if (targetID === SUPER_ADMIN_ID) {
                return api.sendMessage("ไม่สามารถเพิ่มผู้ดูแลสูงสุดซ้ำได้ครับ", threadID, messageID);
            }

            // เพิ่มแอดมินใหม่
            admins.push(targetID);
            saveAdmins(admins);

            // ดึงชื่อผู้ใช้เพื่อแสดงในข้อความตอบกลับ
            const userInfo = await api.getUserInfo(targetID);
            const targetName = userInfo[targetID]?.name || `ผู้ใช้ UID: ${targetID}`;

            api.sendMessage(`✅ แต่งตั้ง "${targetName}" เป็นแอดมินของบอทเรียบร้อยแล้ว`, threadID, messageID);

        } catch (err) {
            console.error("Add admin command error:", err);
            api.sendMessage("❌ เกิดข้อผิดพลาดในการเพิ่มแอดมิน", threadID, messageID);
        }
    }
};
