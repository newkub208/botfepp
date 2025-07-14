const fs = require('fs');
const path = require('path');

// JSON file paths for local storage
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const STATS_FILE = path.join(__dirname, '..', 'data', 'stats.json');
const CONFIG_FILE = path.join(__dirname, '..', 'data', 'config.json');

// Ensure data directory exists
const dataDir = path.dirname(USERS_FILE);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Helper functions for JSON file operations
function readJsonFile(filePath, defaultData = {}) {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return defaultData;
    } catch (error) {
        console.error(`Error reading JSON file ${filePath}:`, error);
        return defaultData;
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing JSON file ${filePath}:`, error);
        return false;
    }
}

// ฟังก์ชันตรวจสอบสถานะสมาชิก
async function checkMemberStatus(userID) {
    try {
        const users = readJsonFile(USERS_FILE, {});
        const user = users[userID];
        
        if (user && user.status === 'active') {
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
        const users = readJsonFile(USERS_FILE, {});
        
        if (users[userID]) {
            users[userID].lastActive = new Date().toISOString();
            users[userID].commandsUsed = (users[userID].commandsUsed || 0) + 1;
            writeJsonFile(USERS_FILE, users);
        }
    } catch (error) {
        console.error('Error updating last activity:', error);
    }
}

// ฟังก์ชันตรวจสอบก่อนรันคำสั่ง
async function checkPermissionBeforeCommand(api, event, commandName) {
    const { senderID, threadID } = event;
    
    // ดึง adminUID จาก config file หรือใช้ค่าเริ่มต้น
    let adminUID = null;
    try {
        const config = readJsonFile(CONFIG_FILE, {});
        adminUID = config.adminUID;
    } catch (error) {
        // ถ้าไม่สามารถดึงจาก config ได้ ให้ใช้ค่าเริ่มต้นจาก getCurrentUserID
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
        const users = readJsonFile(USERS_FILE, {});
        return users[userID] || null;
    } catch (error) {
        console.error('Error getting member info:', error);
        return null;
    }
}

// ฟังก์ชันดึงสถิติทั้งหมด
async function getStats() {
    try {
        const users = readJsonFile(USERS_FILE, {});
        const stats = readJsonFile(STATS_FILE, {});
        
        const userList = Object.values(users);
        const activeUsers = userList.filter(user => user.status === 'active').length;
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

// ฟังก์ชันบันทึก config
async function saveConfig(configData) {
    try {
        return writeJsonFile(CONFIG_FILE, configData);
    } catch (error) {
        console.error('Error saving config:', error);
        return false;
    }
}

// ฟังก์ชันดึง config
async function getConfig() {
    try {
        return readJsonFile(CONFIG_FILE, {});
    } catch (error) {
        console.error('Error getting config:', error);
        return {};
    }
}

// ฟังก์ชันเพิ่มผู้ใช้ใหม่
function addUser(userID, userData) {
    try {
        const users = readJsonFile(USERS_FILE, {});
        users[userID] = {
            ...userData,
            registeredAt: new Date().toISOString(),
            status: 'active',
            lastActive: new Date().toISOString(),
            commandsUsed: 0
        };
        return writeJsonFile(USERS_FILE, users);
    } catch (error) {
        console.error('Error adding user:', error);
        return false;
    }
}

module.exports = {
    checkMemberStatus,
    updateLastActivity,
    checkPermissionBeforeCommand,
    getMemberInfo,
    getStats,
    saveConfig,
    getConfig,
    addUser,
    readJsonFile,
    writeJsonFile,
    USERS_FILE,
    STATS_FILE,
    CONFIG_FILE
};
