const fs = require('fs');
const path = require('path');

// --- กำหนดค่าคงที่ ---
const ADMIN_DETAILED_PATH = path.join(__dirname, '../../admin_detailed.json');

// --- ฟังก์ชันสำหรับโหลดข้อมูลแอดมินแบบละเอียด ---
function loadDetailedAdmins() {
    try {
        if (fs.existsSync(ADMIN_DETAILED_PATH)) {
            const data = fs.readFileSync(ADMIN_DETAILED_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading detailed admin data:', error);
    }
    return {
        superAdmin: '61555184860915',
        temporaryAdmins: {},
        adminHistory: []
    };
}

// --- ฟังก์ชันสำหรับบันทึกข้อมูลแอดมินแบบละเอียด ---
function saveDetailedAdmins(data) {
    try {
        fs.writeFileSync(ADMIN_DETAILED_PATH, JSON.stringify(data, null, 2));
        
        // อัพเดทไฟล์แอดมินแบบเก่าด้วย (เฉพาะแอดมินถาวรเท่านั้น)
        // ไม่เขียนแอดมินชั่วคราวลงไฟล์ admin_list.json
        const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json');
        
        // โหลดข้อมูลแอดมินถาวรปัจจุบัน (ถ้ามี)
        let permanentAdmins = [];
        try {
            if (fs.existsSync(ADMIN_FILE_PATH)) {
                const currentData = fs.readFileSync(ADMIN_FILE_PATH, 'utf8');
                permanentAdmins = JSON.parse(currentData);
            }
        } catch (e) {
            console.log('Error loading permanent admins:', e);
        }
        
        // เขียนเฉพาะแอดมินถาวรกลับไป (ไม่รวมแอดมินชั่วคราว)
        fs.writeFileSync(ADMIN_FILE_PATH, JSON.stringify(permanentAdmins, null, 2));
    } catch (error) {
        console.error('Error saving detailed admin data:', error);
    }
}

// --- ฟังก์ชันอัพเดทจำนวนการเตะ ---
function updateKickCount(adminId) {
    console.log(`[ADMIN_MANAGER] updateKickCount called for ${adminId}`);
    cleanExpiredAdmins(); // ล้างแอดมินที่หมดอายุก่อน
    
    const data = loadDetailedAdmins();
    console.log(`[ADMIN_MANAGER] Current admin data:`, data.temporaryAdmins[adminId]);
    
    if (data.temporaryAdmins[adminId]) {
        const admin = data.temporaryAdmins[adminId];
        const now = new Date();
        const expireTime = new Date(admin.expiresAt);
        
        // ตรวจสอบว่าหมดอายุหรือไม่
        if (now >= expireTime) {
            console.log(`[ADMIN_MANAGER] Admin ${adminId} expired`);
            return { removed: true, reason: 'หมดอายุแล้ว', maxKicks: admin.maxKicks || 5 };
        }
        
        admin.kickCount = (admin.kickCount || 0) + 1;
        admin.lastKick = new Date().toISOString();
        
        const maxKicks = admin.maxKicks || 5;
        console.log(`[ADMIN_MANAGER] Updated kickCount to ${admin.kickCount}/${maxKicks}`);
        
        // ถ้าเตะครบตามจำนวนที่กำหนด ให้ลบออกจากแอดมิน
        if (admin.kickCount >= maxKicks) {
            console.log(`[ADMIN_MANAGER] Admin ${adminId} reached max kicks, removing...`);
            // บันทึกประวัติ
            data.adminHistory.push({
                adminId: adminId,
                addedAt: admin.addedAt,
                addedBy: admin.addedBy,
                removedAt: new Date().toISOString(),
                removedReason: `เตะครบ ${maxKicks} คน`,
                kickCount: admin.kickCount,
                maxKicks: maxKicks,
                duration: admin.duration
            });
            
            delete data.temporaryAdmins[adminId];
            saveDetailedAdmins(data);
            return { removed: true, reason: `เตะครบ ${maxKicks} คน`, maxKicks };
        }
        
        saveDetailedAdmins(data);
        console.log(`[ADMIN_MANAGER] Saved updated data`);
        return { 
            removed: false, 
            kickCount: admin.kickCount,
            maxKicks: maxKicks,
            remaining: maxKicks - admin.kickCount
        };
    }
    
    console.log(`[ADMIN_MANAGER] No temporary admin found for ${adminId}`);
    return null;
}

// --- ฟังก์ชันตรวจสอบและล้างแอดมินที่หมดอายุ ---
function cleanExpiredAdmins() {
    const data = loadDetailedAdmins();
    let hasChanges = false;
    const now = new Date();
    
    for (const adminId in data.temporaryAdmins) {
        const admin = data.temporaryAdmins[adminId];
        const expireTime = new Date(admin.expiresAt);
        
        if (now >= expireTime) {
            // บันทึกประวัติ
            data.adminHistory.push({
                adminId: adminId,
                addedAt: admin.addedAt,
                addedBy: admin.addedBy,
                removedAt: now.toISOString(),
                removedReason: 'หมดอายุ',
                kickCount: admin.kickCount || 0,
                maxKicks: admin.maxKicks || 5,
                duration: admin.duration
            });
            
            delete data.temporaryAdmins[adminId];
            hasChanges = true;
        }
    }
    
    if (hasChanges) {
        saveDetailedAdmins(data);
    }
    
    return hasChanges;
}

// --- ฟังก์ชันตรวจสอบสิทธิ์แอดมินชั่วคราว ---
function checkTemporaryAdminPermission(adminId) {
    cleanExpiredAdmins(); // ล้างแอดมินที่หมดอายุก่อน
    
    const data = loadDetailedAdmins();
    if (data.temporaryAdmins[adminId]) {
        const admin = data.temporaryAdmins[adminId];
        const now = new Date();
        const expireTime = new Date(admin.expiresAt);
        const maxKicks = admin.maxKicks || 5;
        
        // ตรวจสอบว่าหมดอายุหรือไม่
        if (now >= expireTime) {
            return false;
        }
        
        // ตรวจสอบว่าใช้สิทธิ์เตะครบแล้วหรือไม่
        if (admin.kickCount >= maxKicks) {
            return false;
        }
        
        return admin.isActive;
    }
    
    return false;
}

module.exports = {
    updateKickCount,
    loadDetailedAdmins,
    saveDetailedAdmins,
    cleanExpiredAdmins,
    checkTemporaryAdminPermission
};
