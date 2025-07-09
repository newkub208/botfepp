const fs = require('fs');
const path = require('path');

// --- กำหนดค่าคงที่ ---
const BAN_FILE_PATH = path.join(__dirname, '../../ban_list.json'); // ที่อยู่ของไฟล์เก็บรายชื่อผู้ใช้ที่ถูกแบน

// --- ฟังก์ชันสำหรับโหลดรายชื่อผู้ใช้ที่ถูกแบน ---
function loadBannedUsers() {
    try {
        if (fs.existsSync(BAN_FILE_PATH)) {
            const data = fs.readFileSync(BAN_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading ban list:', error);
    }
    return {};
}

// --- ฟังก์ชันสำหรับบันทึกรายชื่อผู้ใช้ที่ถูกแบน ---
function saveBannedUsers(bannedUsers) {
    try {
        fs.writeFileSync(BAN_FILE_PATH, JSON.stringify(bannedUsers, null, 2));
    } catch (error) {
        console.error('Error saving ban list:', error);
    }
}

// --- ฟังก์ชันตรวจสอบว่าการแบนหมดอายุแล้วหรือไม่ ---
function isBanExpired(banInfo) {
    if (!banInfo.banUntil) return false; // แบนถาวร
    return Date.now() > banInfo.banUntil;
}

module.exports = {
    name: "banChecker",
    description: "ตรวจสอบและเตะผู้ใช้ที่ถูกแบนออกจากกลุ่ม",

    async handleEvent(api, event) {
        const { threadID, logMessageType, logMessageData } = event;

        // ตรวจสอบเฉพาะเหตุการณ์ที่มีผู้ใช้เข้ากลุ่ม
        if (logMessageType !== "log:subscribe") return;

        try {
            const bannedUsers = loadBannedUsers();
            const addedUsers = logMessageData.addedParticipants || [];

            for (const user of addedUsers) {
                const userID = user.userFbId;
                
                // ตรวจสอบว่าผู้ใช้ถูกแบนหรือไม่
                if (bannedUsers[userID]) {
                    const banInfo = bannedUsers[userID];
                    
                    // ตรวจสอบว่าการแบนหมดอายุแล้วหรือไม่
                    if (isBanExpired(banInfo)) {
                        // ลบออกจากรายชื่อผู้ถูกแบนเนื่องจากหมดอายุ
                        delete bannedUsers[userID];
                        saveBannedUsers(bannedUsers);
                        console.log(`Ban expired for user ${userID}, removed from ban list`);
                        continue;
                    }

                    // ดึงชื่อผู้ใช้
                    const userInfo = await api.getUserInfo(userID);
                    const userName = userInfo[userID]?.name || `ผู้ใช้ UID: ${userID}`;

                    // เตะผู้ใช้ที่ถูกแบนออกทันที
                    try {
                        await api.removeUserFromGroup(userID, threadID);
                        
                        let timeLeft = "ถาวร";
                        if (banInfo.banUntil) {
                            const timeLeftMs = banInfo.banUntil - Date.now();
                            const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
                            
                            if (days > 0) {
                                timeLeft = `${days} วัน ${hours} ชั่วโมง ${minutes} นาที`;
                            } else if (hours > 0) {
                                timeLeft = `${hours} ชั่วโมง ${minutes} นาที`;
                            } else {
                                timeLeft = `${minutes} นาที`;
                            }
                        }

                        const kickMessage = `🚫 เตะ "${userName}" ออกจากกลุ่มอัตโนมัติ\n` +
                            `📝 เหตุผล: ${banInfo.reason}\n` +
                            `⏰ เวลาคงเหลือ: ${timeLeft}\n` +
                            `📅 ถูกแบนเมื่อ: ${new Date(banInfo.bannedAt).toLocaleString('th-TH')}`;

                        api.sendMessage(kickMessage, threadID);
                        
                    } catch (error) {
                        console.error(`Error removing banned user ${userID}:`, error);
                        api.sendMessage(`❌ ไม่สามารถเตะ "${userName}" ออกจากกลุ่มได้`, threadID);
                    }
                }
            }

        } catch (error) {
            console.error('Error in ban checker:', error);
        }
    }
};
