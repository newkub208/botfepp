const fs = require('fs');
const path = require('path');
const { updateKickCount, loadDetailedAdmins, checkTemporaryAdminPermission, cleanExpiredAdmins } = require('../../utils/adminManager');

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
    console.log(`[KICK] Checking admin permission for ${senderID}`);
    
    if (senderID === SUPER_ADMIN_ID) {
        console.log(`[KICK] ${senderID} is super admin`);
        return { isAdmin: true, isTemporary: false };
    }
    
    // ล้างแอดมินที่หมดอายุก่อน
    cleanExpiredAdmins();
    
    // ตรวจสอบแอดมินชั่วคราว
    const tempAdminCheck = checkTemporaryAdminPermission(senderID);
    console.log(`[KICK] Temporary admin check for ${senderID}: ${tempAdminCheck}`);
    
    if (tempAdminCheck) {
        console.log(`[KICK] ${senderID} is temporary admin`);
        return { isAdmin: true, isTemporary: true };
    }
    
    // ตรวจสอบแอดมินธรรมดา
    const admins = loadAdmins();
    const isRegularAdmin = admins.includes(senderID);
    console.log(`[KICK] Regular admin check for ${senderID}: ${isRegularAdmin}`);
    
    return { isAdmin: isRegularAdmin, isTemporary: false };
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
      const adminCheck = hasAdminPermission(senderID);
      const isGroupAdmin = groupAdminIDs.includes(senderID);
      
      if (!adminCheck.isAdmin && !isGroupAdmin) {
        return api.sendMessage("❌ สิทธิ์แอดมินของคุณหมดแล้ว!\n⚠️ คุณไม่สามารถใช้คำสั่งเตะได้อีก", threadID, messageID);
      }

      // --- 2.1 ตรวจสอบขีดจำกัดการเตะสำหรับแอดมินชั่วคราว ---
      if (adminCheck.isTemporary) {
        console.log(`[KICK] Checking temporary admin limits for ${senderID}`);
        const detailedData = loadDetailedAdmins();
        const admin = detailedData.temporaryAdmins[senderID];
        
        if (!admin) {
          console.log(`[KICK] No temporary admin data found for ${senderID}`);
          return api.sendMessage("❌ ไม่พบข้อมูลแอดมินชั่วคราว", threadID, messageID);
        }
        
        console.log(`[KICK] Admin data:`, admin);
        
        // ตรวจสอบการหมดอายุ
        const now = new Date();
        const expireTime = new Date(admin.expiresAt);
        if (now >= expireTime) {
          console.log(`[KICK] Admin ${senderID} expired`);
          return api.sendMessage(
            `❌ สิทธิ์แอดมินของคุณหมดอายุแล้ว!\n` +
            `📅 หมดอายุเมื่อ: ${expireTime.toLocaleString('th-TH')}`,
            threadID, 
            messageID
          );
        }
        
        // ตรวจสอบขีดจำกัดการเตะ
        if (admin.kickCount >= (admin.maxKicks || 5)) {
          console.log(`[KICK] Admin ${senderID} reached kick limit: ${admin.kickCount}/${admin.maxKicks}`);
          return api.sendMessage(
            `❌ คุณใช้สิทธิ์เตะครบแล้ว!\n` +
            `📊 เตะแล้ว: ${admin.kickCount}/${admin.maxKicks || 5} ครั้ง\n` +
            `⚠️ คุณจะถูกลบออกจากตำแหน่งแอดมินอัตโนมัติ`,
            threadID, 
            messageID
          );
        }
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
      
      if (adminCheck.isAdmin && adminCheck.isTemporary) {
        console.log(`[KICK] Updating kick count for temporary admin ${senderID}`);
        const kickResult = updateKickCount(senderID);
        console.log(`[KICK] Kick result:`, kickResult);
        
        if (kickResult) {
          if (kickResult.removed) {
            kickMessage += `\n\n🚫 สิทธิ์แอดมินของคุณหมดแล้ว!\n` +
                          `📍 สาเหตุ: ${kickResult.reason}\n` +
                          `⚠️ คุณไม่สามารถใช้คำสั่งเตะได้อีกแล้ว`;
            
            // ส่งข้อความแจ้งเตือนให้ Super Admin
            try {
              await api.sendMessage(
                `⚠️ แจ้งเตือน: แอดมินชั่วคราว (${senderID}) ถูกลบออกอัตโนมัติ\n` +
                `📍 สาเหตุ: ${kickResult.reason}\n` +
                `🎯 จำนวนการเตะที่กำหนด: ${kickResult.maxKicks} ครั้ง\n` +
                `📅 เวลา: ${new Date().toLocaleString('th-TH')}`,
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
        } else {
          console.log(`[KICK] Warning: No kick result returned for ${senderID}`);
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
