const authManager = require('../utils/authManager');

// รายการคำสั่งที่ไม่ต้องตรวจสอบการลงชื่อเข้าใช้
const EXCLUDED_COMMANDS = [
    'เข้าสู่ระบบ', 'login', 'signin', 'auth',
    'ช่วยเหลือ', 'help', 'คำสั่ง', 'commands'
];

/**
 * ตรวจสอบการลงชื่อเข้าใช้ก่อนรันคำสั่ง
 * @param {string} commandName - ชื่อคำสั่ง
 * @param {string} userID - ID ของผู้ใช้
 * @param {object} api - Facebook API object
 * @param {object} event - Event object
 * @returns {Promise<{allowed: boolean, message?: string}>}
 */
async function checkAuthBeforeCommand(commandName, userID, api, event) {
    const { threadID, messageID } = event;
    
    // ตรวจสอบว่าเป็นคำสั่งที่ยกเว้นหรือไม่
    if (EXCLUDED_COMMANDS.includes(commandName.toLowerCase())) {
        return { allowed: true };
    }
    
    // ตรวจสอบ session
    const sessionCheck = await authManager.validateSession(userID);
    
    if (!sessionCheck.valid) {
        // ส่งข้อความแจ้งเตือนให้ลงชื่อเข้าใช้
        let authMessage = "🔐 ต้องลงชื่อเข้าใช้ก่อน!\n\n";
        authMessage += "❌ คุณยังไม่ได้ลงชื่อเข้าใช้ระบบ\n";
        authMessage += "กรุณาลงชื่อเข้าใช้ก่อนใช้คำสั่งนี้\n\n";
        
        // ตรวจสอบสาเหตุ
        if (sessionCheck.error === 'ไม่พบ session') {
            authMessage += "💡 วิธีเข้าสู่ระบบ:\n";
            authMessage += "1. สมัครสมาชิก: เข้าสู่ระบบ สมัคร [ชื่อของคุณ]\n";
            authMessage += "2. เข้าสู่ระบบ: เข้าสู่ระบบ เข้า [รหัสผ่าน]\n\n";
            authMessage += "หากยังไม่มีบัญชี กรุณาสมัครสมาชิกก่อน";
        } else if (sessionCheck.error === 'Session หมดอายุ') {
            authMessage += "⏰ Session หมดอายุแล้ว\n";
            authMessage += "กรุณาเข้าสู่ระบบใหม่: เข้าสู่ระบบ เข้า [รหัสผ่าน]";
        } else {
            authMessage += `⚠️ สาเหตุ: ${sessionCheck.error}`;
        }
        
        // ส่งข้อความแจ้งเตือน
        api.sendMessage(authMessage, threadID, messageID);
        
        return { 
            allowed: false, 
            message: `User ${userID} attempted to use command '${commandName}' without authentication` 
        };
    }
    
    // Session ถูกต้อง - อนุญาตให้ใช้คำสั่ง
    return { allowed: true };
}

/**
 * ตรวจสอบว่าผู้ใช้เป็น Admin หรือไม่
 * @param {string} userID - ID ของผู้ใช้
 * @param {string} adminUID - Admin UID จาก config
 * @returns {boolean}
 */
function isAdmin(userID, adminUID) {
    return userID === adminUID;
}

/**
 * ตรวจสอบการมีสิทธิ์ใช้คำสั่งที่มี role เป็น admin
 * @param {string} userID - ID ของผู้ใช้
 * @param {string} adminUID - Admin UID จาก config
 * @param {object} api - Facebook API object
 * @param {object} event - Event object
 * @returns {Promise<{allowed: boolean}>}
 */
async function checkAdminPermission(userID, adminUID, api, event) {
    const { threadID, messageID } = event;
    
    if (!isAdmin(userID, adminUID)) {
        // ส่งข้อความแจ้งเตือน
        api.sendMessage(
            "🚫 ไม่มีสิทธิ์ใช้คำสั่งนี้\n\n" +
            "คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบเท่านั้น",
            threadID, messageID
        );
        
        return { allowed: false };
    }
    
    return { allowed: true };
}

/**
 * บันทึก log การใช้คำสั่ง
 * @param {string} userID - ID ของผู้ใช้
 * @param {string} commandName - ชื่อคำสั่ง
 * @param {string} threadID - ID ของกลุ่ม
 * @param {boolean} success - ผลการดำเนินการ
 */
function logCommandUsage(userID, commandName, threadID, success) {
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILED';
    
    console.log(`[COMMAND LOG] ${timestamp} | User: ${userID} | Command: ${commandName} | Thread: ${threadID} | Status: ${status}`);
}

/**
 * ตรวจสอบ rate limiting (จำกัดการใช้คำสั่งต่อวินาที)
 */
class RateLimiter {
    constructor() {
        this.userRequests = new Map();
        this.maxRequestsPerMinute = 30; // จำกัด 30 คำสั่งต่อนาที
        this.windowMs = 60 * 1000; // 1 นาที
    }
    
    isAllowed(userID) {
        const now = Date.now();
        
        if (!this.userRequests.has(userID)) {
            this.userRequests.set(userID, []);
        }
        
        const userRequestTimes = this.userRequests.get(userID);
        
        // ลบคำขอที่เก่าเกินกว่า window
        const validRequests = userRequestTimes.filter(time => now - time < this.windowMs);
        this.userRequests.set(userID, validRequests);
        
        // ตรวจสอบว่าเกินจำนวนที่อนุญาตหรือไม่
        if (validRequests.length >= this.maxRequestsPerMinute) {
            return false;
        }
        
        // บันทึกคำขอใหม่
        validRequests.push(now);
        this.userRequests.set(userID, validRequests);
        
        return true;
    }
    
    getRemainingRequests(userID) {
        const userRequestTimes = this.userRequests.get(userID) || [];
        return Math.max(0, this.maxRequestsPerMinute - userRequestTimes.length);
    }
}

// สร้าง instance ของ RateLimiter
const rateLimiter = new RateLimiter();

/**
 * ตรวจสอบ rate limiting
 * @param {string} userID - ID ของผู้ใช้
 * @param {object} api - Facebook API object
 * @param {object} event - Event object
 * @returns {boolean}
 */
function checkRateLimit(userID, api, event) {
    const { threadID, messageID } = event;
    
    if (!rateLimiter.isAllowed(userID)) {
        const remaining = rateLimiter.getRemainingRequests(userID);
        
        api.sendMessage(
            "⏱️ ใช้คำสั่งเร็วเกินไป!\n\n" +
            `คุณใช้คำสั่งเกินจำนวนที่อนุญาต (${rateLimiter.maxRequestsPerMinute} ครั้งต่อนาที)\n` +
            "กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
            threadID, messageID
        );
        
        return false;
    }
    
    return true;
}

module.exports = {
    checkAuthBeforeCommand,
    checkAdminPermission,
    isAdmin,
    logCommandUsage,
    checkRateLimit,
    EXCLUDED_COMMANDS
};
