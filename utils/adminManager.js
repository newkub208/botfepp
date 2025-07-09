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
        
        // อัพเดทไฟล์แอดมินแบบเก่าด้วย
        const activeAdmins = Object.keys(data.temporaryAdmins).filter(id => {
            const admin = data.temporaryAdmins[id];
            return admin.isActive && new Date(admin.expiresAt) > new Date();
        });
        const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json');
        fs.writeFileSync(ADMIN_FILE_PATH, JSON.stringify(activeAdmins, null, 2));
    } catch (error) {
        console.error('Error saving detailed admin data:', error);
    }
}

// --- ฟังก์ชันอัพเดทจำนวนการเตะ ---
function updateKickCount(adminId) {
    const data = loadDetailedAdmins();
    
    if (data.temporaryAdmins[adminId]) {
        const admin = data.temporaryAdmins[adminId];
        admin.kickCount += 1;
        admin.lastKick = new Date().toISOString();
        
        const maxKicks = admin.maxKicks || 5; // ใช้ค่าเริ่มต้น 5 ถ้าไม่มีการกำหนด
        
        // ถ้าเตะครบตามจำนวนที่กำหนด ให้ลบออกจากแอดมิน
        if (admin.kickCount >= maxKicks) {
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
        return { 
            removed: false, 
            kickCount: admin.kickCount,
            maxKicks: maxKicks,
            remaining: maxKicks - admin.kickCount
        };
    }
    
    return null;
}

module.exports = {
    updateKickCount,
    loadDetailedAdmins,
    saveDetailedAdmins
};
