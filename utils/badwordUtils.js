// Utility functions สำหรับระบบ badword filter
// แก้ไข deprecation warning และปรับปรุงการทำงาน

const fs = require('fs');
const path = require('path');

// แทนที่ util.isArray ด้วย Array.isArray เพื่อแก้ deprecation warning
if (typeof global !== 'undefined') {
    // ตรวจสอบและแก้ไข util.isArray deprecation
    const originalRequire = require;
    require = function(id) {
        const module = originalRequire.apply(this, arguments);
        if (id === 'util' && module.isArray) {
            // แทนที่ util.isArray ด้วย Array.isArray
            module.isArray = Array.isArray;
        }
        return module;
    };
    Object.setPrototypeOf(require, originalRequire);
    Object.defineProperties(require, Object.getOwnPropertyDescriptors(originalRequire));
}

// การตั้งค่าการจัดการ error codes
const ERROR_CODES = {
    1357031: {
        name: 'CONTENT_NOT_AVAILABLE',
        description: 'สมาชิกไม่สามารถเตะได้ (อาจเป็นแอดมินหรือออกจากกลุ่มแล้ว)',
        action: 'warn_only'
    },
    1357004: {
        name: 'INSUFFICIENT_PERMISSIONS',
        description: 'บอทไม่มีสิทธิ์แอดมิน',
        action: 'request_admin'
    },
    1357047: {
        name: 'USER_NOT_IN_GROUP',
        description: 'สมาชิกไม่อยู่ในกลุ่ม',
        action: 'warn_only'
    }
};

// ฟังก์ชันจัดการ error message
function getErrorMessage(error) {
    const errorInfo = ERROR_CODES[error.error];
    
    if (errorInfo) {
        switch (errorInfo.action) {
            case 'warn_only':
                return `⚠️ ตรวจพบคำไม่สุภาพ!\n\n` +
                       `${errorInfo.description}\n` +
                       `กรุณาใช้คำพูดที่สุภาพในกลุ่มนี้`;
                       
            case 'request_admin':
                return `⚠️ ไม่สามารถเตะสมาชิกได้\n\n` +
                       `${errorInfo.description}\n` +
                       `กรุณาให้สิทธิ์แอดมินกับบอท`;
                       
            default:
                return `⚠️ ตรวจพบคำไม่สุภาพ!\n\n` +
                       `${errorInfo.description}\n` +
                       `กรุณาใช้คำพูดที่สุภาพในกลุ่มนี้`;
        }
    }
    
    // Default error message
    return `⚠️ ตรวจพบคำไม่สุภาพ!\n\n` +
           `กรุณาใช้คำพูดที่สุภาพในกลุ่มนี้\n` +
           `(Error: ${error.errorSummary || 'ไม่ทราบสาเหตุ'})`;
}

// ฟังก์ชันตรวจสอบสิทธิ์ของบอทในกลุ่ม
async function checkBotPermissions(api, threadID) {
    try {
        const threadInfo = await api.getThreadInfo(threadID);
        const botID = api.getCurrentUserID();
        
        // ตรวจสอบว่าบอทเป็นแอดมินหรือไม่
        const isAdmin = threadInfo.adminIDs.some(admin => admin.id === botID);
        
        return {
            isAdmin,
            threadType: threadInfo.threadType,
            memberCount: threadInfo.participantIDs.length
        };
    } catch (error) {
        console.error('Error checking bot permissions:', error);
        return {
            isAdmin: false,
            threadType: 'unknown',
            memberCount: 0
        };
    }
}

// ฟังก์ชันพยายามเตะสมาชิกด้วยการจัดการ error ที่ดีขึ้น
async function safeRemoveUser(api, userID, threadID) {
    try {
        // ตรวจสอบสิทธิ์ก่อน
        const permissions = await checkBotPermissions(api, threadID);
        
        if (!permissions.isAdmin) {
            throw {
                error: 1357004,
                errorSummary: 'Bot is not admin',
                errorDescription: 'Bot needs admin permission to remove users'
            };
        }
        
        // พยายามเตะสมาชิก
        await api.removeUserFromGroup(userID, threadID);
        
        return {
            success: true,
            message: '🚫 ระบบกรองคำหยาบ\n\nสมาชิกถูกเตะออกจากกลุ่มเนื่องจากใช้คำไม่สุภาพ\nกลุ่มนี้ไม่อนุญาตให้ใช้คำหยาบหรือคำไม่สุภาพ'
        };
        
    } catch (error) {
        return {
            success: false,
            error: error,
            message: getErrorMessage(error)
        };
    }
}

// ฟังก์ชัน delay เพื่อป้องกัน rate limiting
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ฟังก์ชันบันทึก log
function logBadwordAction(action, userID, threadID, word = '') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [BADWORD] ${action}: User ${userID} in Group ${threadID}${word ? ` (word: ${word})` : ''}`;
    
    console.log(logMessage);
    
    // บันทึกลงไฟล์ log (optional)
    try {
        const logPath = path.join(__dirname, '../../logs');
        if (!fs.existsSync(logPath)) {
            fs.mkdirSync(logPath, { recursive: true });
        }
        
        const logFile = path.join(logPath, 'badword.log');
        fs.appendFileSync(logFile, logMessage + '\n');
    } catch (error) {
        // ไม่สำคัญถ้าบันทึก log ไม่ได้
    }
}

module.exports = {
    ERROR_CODES,
    getErrorMessage,
    checkBotPermissions,
    safeRemoveUser,
    delay,
    logBadwordAction
};
