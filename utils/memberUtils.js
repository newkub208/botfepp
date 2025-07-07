const axios = require('axios');

// Firebase Database URL - ใช้เก็บข้อมูลผู้ลงทะเบียนแทน JSON
const FIREBASE_URL = 'https://apikf-bbe63-default-rtdb.europe-west1.firebasedatabase.app';

// ฟังก์ชันตรวจสอบสถานะสมาชิก
async function checkMemberStatus(userID) {
    try {
        const response = await axios.get(`${FIREBASE_URL}/users/${userID}.json`);
        if (response.data && response.data.status === 'active') {
            // อัปเดตการใช้งานล่าสุด
            await updateLastActivity(userID);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking member status:', error);
        return false;
    }
}

// ฟังก์ชันอัปเดตการใช้งานล่าสุด
async function updateLastActivity(userID) {
    try {
        const updateData = {
            lastActive: new Date().toISOString()
        };
        
        // เพิ่มจำนวนการใช้คำสั่ง
        const userResponse = await axios.get(`${FIREBASE_URL}/users/${userID}.json`);
        if (userResponse.data) {
            updateData.commandsUsed = (userResponse.data.commandsUsed || 0) + 1;
        }
        
        await axios.patch(`${FIREBASE_URL}/users/${userID}.json`, updateData);
    } catch (error) {
        console.error('Error updating last activity:', error);
    }
}

// ฟังก์ชันตรวจสอบก่อนรันคำสั่ง
async function checkPermissionBeforeCommand(api, event, commandName) {
    const { senderID, threadID } = event;
    
    // ดึง adminUID จาก Firebase หรือใช้ค่าเริ่มต้น
    let adminUID = null;
    try {
        const configResponse = await axios.get(`${FIREBASE_URL}/config.json`);
        adminUID = configResponse.data?.adminUID;
    } catch (error) {
        // ถ้าไม่สามารถดึงจาก Firebase ได้ ให้ใช้ค่าเริ่มต้นจาก getCurrentUserID
        try {
            adminUID = api.getCurrentUserID();
        } catch (err) {
            console.error('Cannot get admin UID:', err);
        }
    }
    
    // ข้ามการตรวจสอบสำหรับแอดมิน
    if (senderID === adminUID) {
        return true;
    }
    
    // ข้ามการตรวจสอบสำหรับคำสั่งสมัครสมาชิกและช่วยเหลือ
    const exemptCommands = ['สมัครสมาชิก', 'register', 'สมัคร', 'ลงทะเบียน', 'ช่วยเหลือ', 'help', 'คำสั่ง'];
    if (exemptCommands.includes(commandName)) {
        return true;
    }
    
    // ตรวจสอบสถานะสมาชิก
    const isMember = await checkMemberStatus(senderID);
    
    if (!isMember) {
        // ส่งข้อความแจ้งให้สมัครสมาชิก
        api.sendMessage(
            "🚫 ต้องสมัครสมาชิกก่อนใช้คำสั่งนี้\n\n" +
            "📝 วิธีสมัครสมาชิก:\n" +
            "• พิมพ์: สมัครสมาชิก\n" +
            "• หรือ: /สมัครสมาชิก\n\n" +
            "✅ สมัครฟรี! ใช้เวลาแค่ไม่กี่วินาที\n" +
            "🎯 หลังสมัครจะใช้คำสั่งอื่นๆ ได้ทันที",
            threadID
        );
        return false;
    }
    
    return true;
}

// ฟังก์ชันดึงข้อมูลสมาชิก
async function getMemberInfo(userID) {
    try {
        const response = await axios.get(`${FIREBASE_URL}/users/${userID}.json`);
        return response.data || null;
    } catch (error) {
        console.error('Error getting member info:', error);
        return null;
    }
}

// ฟังก์ชันดึงสถิติทั้งหมด
async function getStats() {
    try {
        const [usersResponse, statsResponse] = await Promise.all([
            axios.get(`${FIREBASE_URL}/users.json`),
            axios.get(`${FIREBASE_URL}/stats.json`)
        ]);
        
        const users = usersResponse.data || {};
        const stats = statsResponse.data || {};
        
        const activeUsers = Object.values(users).filter(user => user.status === 'active').length;
        const totalUsers = Object.keys(users).length;
        
        return {
            totalUsers,
            activeUsers,
            registrationsToday: stats.registrationsToday || 0,
            ...stats
        };
    } catch (error) {
        console.error('Error getting stats:', error);
        return null;
    }
}

// ฟังก์ชันบันทึก config ลง Firebase
async function saveConfigToFirebase(configData) {
    try {
        await axios.put(`${FIREBASE_URL}/config.json`, configData);
        return true;
    } catch (error) {
        console.error('Error saving config to Firebase:', error);
        return false;
    }
}

// ฟังก์ชันดึง config จาก Firebase
async function getConfigFromFirebase() {
    try {
        const response = await axios.get(`${FIREBASE_URL}/config.json`);
        return response.data || {};
    } catch (error) {
        console.error('Error getting config from Firebase:', error);
        return {};
    }
}

module.exports = {
    checkMemberStatus,
    updateLastActivity,
    checkPermissionBeforeCommand,
    getMemberInfo,
    getStats,
    saveConfigToFirebase,
    getConfigFromFirebase,
    FIREBASE_URL
};
