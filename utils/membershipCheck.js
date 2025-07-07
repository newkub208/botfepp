const axios = require('axios');

// Firebase Realtime Database URL
const FIREBASE_URL = 'https://apikf-bbe63-default-rtdb.europe-west1.firebasedatabase.app';

/**
 * ตรวจสอบว่าผู้ใช้เป็นสมาชิกหรือไม่
 * @param {string} userID - ID ของผู้ใช้
 * @returns {Promise<Object>} - ข้อมูลผู้ใช้หรือ null หากไม่เป็นสมาชิก
 */
async function checkMembership(userID) {
    try {
        const response = await axios.get(`${FIREBASE_URL}/users/${userID}.json`);
        
        if (response.data && response.data.status === 'active') {
            // อัปเดต lastActive
            const updateData = {
                lastActive: new Date().toISOString(),
                commandsUsed: (response.data.commandsUsed || 0) + 1
            };
            
            // อัปเดตข้อมูลผู้ใช้แบบ async (ไม่รอผลลัพธ์)
            axios.patch(`${FIREBASE_URL}/users/${userID}.json`, updateData).catch(err => {
                console.error('Error updating user activity:', err);
            });
            
            return response.data;
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
        const response = await axios.get(`${FIREBASE_URL}/admins/${userID}.json`);
        return response.data && response.data.status === 'active';
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
        const response = await axios.get(`${FIREBASE_URL}/stats.json`);
        return response.data || { totalUsers: 0, registrationsToday: 0 };
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
        const response = await axios.get(`${FIREBASE_URL}/users.json`);
        if (!response.data) return [];
        
        const members = Object.entries(response.data)
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
    EXEMPT_COMMANDS,
    FIREBASE_URL
};
