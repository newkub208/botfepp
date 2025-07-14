const { readJsonFile, writeJsonFile, USERS_FILE } = require('./memberUtils');

/**
 * ตรวจสอบว่าผู้ใช้เป็นสมาชิกหรือไม่
 * @param {string} userID - ID ของผู้ใช้
 * @returns {Promise<Object>} - ข้อมูลผู้ใช้หรือ null หากไม่เป็นสมาชิก
 */
async function checkMembership(userID) {
    try {
        const users = readJsonFile(USERS_FILE, {});
        const user = users[userID];
        
        if (user && user.status === 'active') {
            // อัปเดต lastActive และ commandsUsed
            user.lastActive = new Date().toISOString();
            user.commandsUsed = (user.commandsUsed || 0) + 1;
            
            // บันทึกกลับลงไฟล์
            writeJsonFile(USERS_FILE, users);
            
            return user;
        }
        
        return null;
    } catch (error) {
        console.error('Error checking membership:', error);
        return null;
    }
}

/**
 * ตรวจสอบว่าผู้ใช้เป็นแอดมินหรือไม่
 * @param {string} userID - ID ของผู้ใช้
 * @returns {Promise<boolean>} - true หากเป็นแอดมิน
 */
async function checkAdminStatus(userID) {
    try {
        const users = readJsonFile(USERS_FILE, {});
        const user = users[userID];
        return user && user.isAdmin === true;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * รายการคำสั่งที่ไม่ต้องตรวจสอบการเป็นสมาชิก
 */
const EXEMPT_COMMANDS = [
    'สมัครสมาชิก',
    'register',
    'signup',
    'สมัคร',
    'ลงทะเบียน',
    'ช่วยเหลือ',
    'help',
    'คำสั่ง',
    'commands'
];

/**
 * ฟังก์ชันตรวจสอบก่อนรันคำสั่ง
 * @param {Object} api - Facebook Chat API
 * @param {Object} event - Event object
 * @param {string} commandName - ชื่อคำสั่งที่จะรัน
 * @returns {Promise<boolean>} - true หากสามารถรันคำสั่งได้
 */
async function validateMembershipBeforeCommand(api, event, commandName) {
    const { threadID, senderID, messageID } = event;
    
    // ข้ามการตรวจสอบสำหรับคำสั่งที่ยกเว้น
    if (EXEMPT_COMMANDS.includes(commandName.toLowerCase())) {
        return true;
    }
    
    // ตรวจสอบการเป็นสมาชิก
    const memberData = await checkMembership(senderID);
    
    if (!memberData) {
        // ส่งข้อความแจ้งให้สมัครสมาชิกก่อน
        const notMemberMessage = 
            `🚫 คุณยังไม่ได้เป็นสมาชิก!\n\n` +
            `📝 กรุณาสมัครสมาชิกก่อนใช้งานบอท:\n` +
            `👉 พิมพ์ "สมัครสมาชิก" เพื่อลงทะเบียน\n\n` +
            `✨ การสมัครฟรี! และใช้เวลาแค่ไม่กี่วินาที\n` +
            `🎯 หลังสมัครแล้วจะสามารถใช้คำสั่งทั้งหมดได้`;
        
        api.sendMessage(notMemberMessage, threadID, messageID);
        return false;
    }
    
    return true;
}

/**
 * รับข้อมูลสถิติสมาชิก
 * @returns {Promise<Object>} - ข้อมูลสถิติ
 */
async function getMembershipStats() {
    try {
        const { readJsonFile, STATS_FILE } = require('./memberUtils');
        const stats = readJsonFile(STATS_FILE, { totalUsers: 0, registrationsToday: 0 });
        return stats;
    } catch (error) {
        console.error('Error getting membership stats:', error);
        return { totalUsers: 0, registrationsToday: 0 };
    }
}

/**
 * รับรายชื่อสมาชิกทั้งหมด (สำหรับแอดมิน)
 * @param {number} limit - จำนวนที่ต้องการ (default: 50)
 * @returns {Promise<Array>} - รายชื่อสมาชิก
 */
async function getAllMembers(limit = 50) {
    try {
        const users = readJsonFile(USERS_FILE, {});
        
        const members = Object.entries(users)
            .map(([userID, userData]) => ({
                userID,
                ...userData
            }))
            .filter(member => member.status === 'active')
            .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
            .slice(0, limit);
            
        return members;
    } catch (error) {
        console.error('Error getting all members:', error);
        return [];
    }
}

module.exports = {
    checkMembership,
    checkAdminStatus,
    validateMembershipBeforeCommand,
    getMembershipStats,
    getAllMembers,
    EXEMPT_COMMANDS
};
