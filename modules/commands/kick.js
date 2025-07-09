const fs = require('fs');
const path = require('path');
const { updateKickCount, loadDetailedAdmins } = require('../../utils/adminManager');

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

// --- ฟังก์ชันตรวจสอบสิทธิ์แอดมิน ---
function hasAdminPermission(senderID) {
    const admins = loadAdmins();
    return senderID === SUPER_ADMIN_ID || admins.includes(senderID);
}

module.exports = {
  name: "kick",
  description: "เตะผู้ใช้ออกจากกลุ่ม (สำหรับแอดมินเท่านั้น)",
  version: "2.0.0",
  aliases: ["kick", "remove"],
  nashPrefix: false,
  cooldowns: 5,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, senderID, mentions, type, messageReply } = event;

    try {
      // --- 1. ดึงข้อมูลกลุ่มเพื่อตรวจสอบสิทธิ์แอดมิน ---
      const threadInfo = await api.getThreadInfo(threadID);
      const groupAdminIDs = threadInfo.adminIDs.map(admin => admin.id);

      // --- 2. ตรวจสอบสิทธิ์ผู้ใช้คำสั่ง ---
      const isBotAdmin = hasAdminPermission(senderID);
      const isGroupAdmin = groupAdminIDs.includes(senderID);
      
      if (!isBotAdmin && !isGroupAdmin) {
        return api.sendMessage("❌ คำสั่งนี้สำหรับแอดมินเท่านั้น", threadID, messageID);
      }

      // --- 3. หาเป้าหมายที่จะเตะ ---
      let targetID = "";
      if (type === "message_reply") {
        targetID = messageReply.senderID;
      } else if (Object.keys(mentions).length > 0) {
        targetID = Object.keys(mentions)[0];
      } else {
        return api.sendMessage(
          `📝 วิธีใช้คำสั่ง:\n` +
          `• ตอบกลับข้อความที่ต้องการเตะ\n` +
          `• แท็กผู้ใช้ที่ต้องการเตะ\n\n` +
          `⚠️ หมายเหตุ: ไม่สามารถเตะแอดมินกลุ่มได้`,
          threadID, 
          messageID
        );
      }
      
      // --- 4. ตรวจสอบเงื่อนไขพิเศษ ---
      if (targetID === api.getCurrentUserID()) {
        return api.sendMessage("❌ ไม่สามารถเตะตัวเอง (บอท) ได้", threadID, messageID);
      }
      
      if (groupAdminIDs.includes(targetID)) {
        return api.sendMessage("❌ ไม่สามารถเตะผู้ดูแลกลุ่มได้", threadID, messageID);
      }

      if (targetID === SUPER_ADMIN_ID) {
        return api.sendMessage("❌ ไม่สามารถเตะผู้ดูแลสูงสุดได้", threadID, messageID);
      }

      // --- 5. ดึงชื่อผู้ใช้ก่อนเตะ ---
      let targetName = `ผู้ใช้ UID: ${targetID}`;
      try {
        const userInfo = await api.getUserInfo(targetID);
        targetName = userInfo[targetID]?.name || targetName;
      } catch (e) {
        // ใช้ค่าเริ่มต้น
      }

      // --- 6. ทำการเตะผู้ใช้ออกจากกลุ่ม ---
      await api.removeUserFromGroup(targetID, threadID);

      // --- 7. อัพเดทจำนวนการเตะ (สำหรับแอดมินชั่วคราว) ---
      let kickMessage = `✅ เตะ "${targetName}" ออกจากกลุ่มเรียบร้อยแล้ว`;
      
      if (isBotAdmin && senderID !== SUPER_ADMIN_ID) {
        const kickResult = updateKickCount(senderID);
        if (kickResult) {
          if (kickResult.removed) {
            kickMessage += `\n\n🚫 คุณถูกลบออกจากตำแหน่งแอดมินเนื่องจาก${kickResult.reason}`;
            
            // ส่งข้อความแจ้งเตือนให้ Super Admin
            try {
              await api.sendMessage(
                `⚠️ แจ้งเตือน: แอดมินชั่วคราว "${targetName}" (${senderID}) ถูกลบออกอัตโนมัติ\n` +
                `📍 สาเหตุ: ${kickResult.reason}\n` +
                `� จำนวนการเตะที่กำหนด: ${kickResult.maxKicks} ครั้ง\n` +
                `�📅 เวลา: ${new Date().toLocaleString('th-TH')}`,
                SUPER_ADMIN_ID
              );
            } catch (e) {
              console.log('Failed to notify super admin:', e);
            }
          } else {
            kickMessage += `\n\n📊 สถิติการเตะของคุณ:\n` +
                          `• เตะแล้ว: ${kickResult.kickCount}/${kickResult.maxKicks} ครั้ง\n` +
                          `• เหลือ: ${kickResult.remaining} ครั้ง\n` +
                          `⚠️ หากเตะครบ ${kickResult.maxKicks} ครั้ง จะถูกลบออกจากแอดมินทันที`;
          }
        }
      }

      api.sendMessage(kickMessage, threadID, messageID);

    } catch (err) {
      console.error("Kick command error:", err);
      api.sendMessage(
        `❌ เกิดข้อผิดพลาดในการเตะผู้ใช้\n` +
        `🔧 สาเหตุ: ${err.message}\n` +
        `💡 ตรวจสอบว่าบอทมีสิทธิ์เพียงพอหรือไม่`,
        threadID, 
        messageID
      );
    }
  }
};
