const fs = require('fs');
const path = require('path');

// เก็บข้อมูลสมาชิกใหม่ที่ยังไม่ได้พูดคุย
const newMembersData = new Map();
const dataFile = path.join(__dirname, 'newMembersData.json');

// โหลดข้อมูลจากไฟล์เมื่อเริ่มต้น
function loadNewMembersData() {
  try {
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      for (const [key, value] of Object.entries(data)) {
        newMembersData.set(key, value);
      }
    }
  } catch (error) {
    console.error('Error loading new members data:', error);
  }
}

// บันทึกข้อมูลลงไฟล์
function saveNewMembersData() {
  try {
    const data = Object.fromEntries(newMembersData);
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving new members data:', error);
  }
}

// ตรวจสอบและเตะสมาชิกที่หมดเวลา
async function checkExpiredMembers(api) {
  const now = Date.now();
  const expiredMembers = [];

  for (const [key, memberData] of newMembersData.entries()) {
    if (now - memberData.joinTime > 10 * 60 * 1000) { // 10 นาที
      expiredMembers.push({ key, ...memberData });
    }
  }

  for (const member of expiredMembers) {
    try {
      // ตรวจสอบว่ายังอยู่ในกลุ่มหรือไม่
      const threadInfo = await api.getThreadInfo(member.threadID);
      const isStillInGroup = threadInfo.participantIDs.includes(member.userID);

      if (isStillInGroup) {
        // ตรวจสอบว่าเป็นแอดมินหรือไม่
        const adminIDs = threadInfo.adminIDs.map(admin => admin.id);
        if (!adminIDs.includes(member.userID)) {
          // เตะออกจากกลุ่ม
          await api.removeUserFromGroup(member.userID, member.threadID);
          
          // ส่งข้อความแจ้งเตือน
          const userName = member.userName || 'สมาชิก';
          await api.sendMessage(
            `⚠️ ${userName} ถูกเตะออกจากกลุ่มเนื่องจากไม่มีการพูดคุยภายใน 10 นาที หลังจากเข้าร่วม`, 
            member.threadID
          );
        }
      }

      // ลบข้อมูลสมาชิกออกจากระบบ
      newMembersData.delete(member.key);
    } catch (error) {
      console.error('Error kicking expired member:', error);
      // ลบข้อมูลสมาชิกออกจากระบบแม้เกิดข้อผิดพลาด
      newMembersData.delete(member.key);
    }
  }

  if (expiredMembers.length > 0) {
    saveNewMembersData();
  }
}

// ตั้งตัวจับเวลาตรวจสอบทุก 30 วินาที
let intervalId = null;

module.exports = {
  name: "newMemberMonitor",
  version: "1.0.0",
  description: "ตรวจสอบและเตะสมาชิกใหม่ที่ไม่พูดคุยใน 10 นาที",
  author: "joshuaApostol",

  // เปิดเผย Map และฟังก์ชันสำหรับการทดสอบ
  newMembersData,
  saveNewMembersData,
  checkExpiredMembers,

  async onEvent({ api, event, prefix }) {
    try {
      // โหลดข้อมูลเมื่อเริ่มต้น
      if (newMembersData.size === 0) {
        loadNewMembersData();
      }

      // ตั้งตัวจับเวลาถ้ายังไม่ได้ตั้ง
      if (!intervalId) {
        intervalId = setInterval(() => {
          checkExpiredMembers(api);
        }, 30000); // ตรวจสอบทุก 30 วินาที
      }

      const { logMessageType, logMessageData, threadID, senderID, type } = event;

      // จัดการเมื่อมีสมาชิกใหม่เข้าร่วม
      if (logMessageType === "log:subscribe" && logMessageData.addedParticipants) {
        const currentUserID = await api.getCurrentUserID();
        
        for (const participant of logMessageData.addedParticipants) {
          // ไม่ต้องจับเวลาบอท
          if (participant.userFbId !== currentUserID) {
            const memberKey = `${threadID}_${participant.userFbId}`;
            
            // เก็บข้อมูลสมาชิกใหม่
            newMembersData.set(memberKey, {
              userID: participant.userFbId,
              threadID: threadID,
              userName: participant.fullName || 'สมาชิกใหม่',
              joinTime: Date.now()
            });
            
            saveNewMembersData();
            
            // ส่งข้อความแจ้งเตือนให้สมาชิกใหม่
            await api.sendMessage(
              `👋 ยินดีต้อนรับ ${participant.fullName || 'สมาชิกใหม่'}!\n` +
              `⏰ กรุณาพูดคุยภายใน 10 นาที มิฉะนั้นจะถูกเตะออกจากกลุ่มอัตโนมัติ`,
              threadID
            );
          }
        }
      }

      // จัดการเมื่อสมาชิกส่งข้อความ
      if (type === "message" && senderID) {
        const memberKey = `${threadID}_${senderID}`;
        
        // ถ้าสมาชิกคนนี้อยู่ในรายการรอ ให้ลบออก (เพราะพูดคุยแล้ว)
        if (newMembersData.has(memberKey)) {
          newMembersData.delete(memberKey);
          saveNewMembersData();
          
          // ส่งข้อความยืนยัน
          const userInfo = await api.getUserInfo(senderID);
          const userName = userInfo[senderID]?.name || 'สมาชิก';
          await api.sendMessage(
            `✅ ยินดีต้อนรับ ${userName} อย่างเป็นทางการ! คุณปลอดภัยแล้ว 🎉`,
            threadID
          );
        }
      }

      // จัดการเมื่อสมาชิกออกจากกลุ่ม
      if (logMessageType === "log:unsubscribe" && logMessageData.leftParticipantFbId) {
        const memberKey = `${threadID}_${logMessageData.leftParticipantFbId}`;
        if (newMembersData.has(memberKey)) {
          newMembersData.delete(memberKey);
          saveNewMembersData();
        }
      }

    } catch (error) {
      console.error('Error in newMemberMonitor:', error);
    }
  },

  // ฟังก์ชันสำหรับดูสถานะสมาชิกใหม่
  getNewMembersStatus() {
    const now = Date.now();
    const members = [];
    
    for (const [key, memberData] of newMembersData.entries()) {
      const timeLeft = 10 * 60 * 1000 - (now - memberData.joinTime);
      members.push({
        ...memberData,
        timeLeft: Math.max(0, timeLeft),
        timeLeftMinutes: Math.max(0, Math.ceil(timeLeft / 60000))
      });
    }
    
    return members;
  },

  // ฟังก์ชันสำหรับล้างข้อมูลสมาชิกใหม่ (สำหรับแอดมิน)
  clearNewMembersData() {
    newMembersData.clear();
    saveNewMembersData();
  }
};
