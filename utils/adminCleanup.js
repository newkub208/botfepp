const { loadDetailedAdmins, saveDetailedAdmins } = require('../utils/adminManager');

// --- ฟังก์ชันทำความสะอาดแอดมินที่หมดอายุ ---
function cleanupExpiredAdmins() {
    try {
        const data = loadDetailedAdmins();
        const now = new Date();
        let hasChanges = false;
        let cleanupResults = {
            expired: [],
            maxKicks: []
        };

        for (const adminId in data.temporaryAdmins) {
            const admin = data.temporaryAdmins[adminId];
            const isExpired = new Date(admin.expiresAt) <= now;
            const maxKicks = admin.maxKicks || 5; // ใช้ค่าเริ่มต้น 5 ถ้าไม่มีการกำหนด
            const hasMaxKicks = admin.kickCount >= maxKicks;

            if (isExpired || hasMaxKicks) {
                // บันทึกประวัติก่อนลบ
                const historyEntry = {
                    adminId: adminId,
                    addedAt: admin.addedAt,
                    addedBy: admin.addedBy,
                    removedAt: new Date().toISOString(),
                    removedReason: hasMaxKicks ? `เตะครบ ${maxKicks} คน` : 'หมดอายุ',
                    kickCount: admin.kickCount,
                    maxKicks: maxKicks,
                    duration: admin.duration
                };

                data.adminHistory.push(historyEntry);

                if (isExpired) {
                    cleanupResults.expired.push({ adminId, admin });
                }
                if (hasMaxKicks) {
                    cleanupResults.maxKicks.push({ adminId, admin, maxKicks });
                }

                delete data.temporaryAdmins[adminId];
                hasChanges = true;
            }
        }

        if (hasChanges) {
            saveDetailedAdmins(data);
            console.log(`[Admin Cleanup] ทำความสะอาดแอดมิน: หมดอายุ ${cleanupResults.expired.length} คน, เตะครบ ${cleanupResults.maxKicks.length} คน`);
        }

        return cleanupResults;
    } catch (error) {
        console.error('Error in admin cleanup:', error);
        return { expired: [], maxKicks: [] };
    }
}

// --- ฟังก์ชันตรวจสอบแอดมินที่ใกล้หมดอายุ ---
function getAdminsNearExpiry(hoursBeforeExpiry = 24) {
    try {
        const data = loadDetailedAdmins();
        const now = new Date();
        const cutoffTime = new Date(now.getTime() + (hoursBeforeExpiry * 60 * 60 * 1000));
        
        const nearExpiry = [];

        for (const adminId in data.temporaryAdmins) {
            const admin = data.temporaryAdmins[adminId];
            const expiresAt = new Date(admin.expiresAt);

            if (admin.isActive && expiresAt > now && expiresAt <= cutoffTime) {
                nearExpiry.push({
                    adminId,
                    admin,
                    hoursLeft: Math.ceil((expiresAt - now) / (1000 * 60 * 60))
                });
            }
        }

        return nearExpiry;
    } catch (error) {
        console.error('Error checking admins near expiry:', error);
        return [];
    }
}

// --- ฟังก์ชันสถิติแอดมิน ---
function getAdminStatistics() {
    try {
        const data = loadDetailedAdmins();
        const now = new Date();

        const stats = {
            active: 0,
            expired: 0,
            kickedOut: 0,
            totalHistory: data.adminHistory.length,
            activeAdmins: [],
            nearExpiry: getAdminsNearExpiry(24) // 24 ชั่วโมง
        };

        // นับแอดมินที่ใช้งานอยู่
        for (const adminId in data.temporaryAdmins) {
            const admin = data.temporaryAdmins[adminId];
            if (admin.isActive && new Date(admin.expiresAt) > now) {
                stats.active++;
                stats.activeAdmins.push({
                    adminId,
                    kickCount: admin.kickCount,
                    maxKicks: admin.maxKicks || 5, // ใช้ค่าเริ่มต้น 5 ถ้าไม่มีการกำหนด
                    expiresAt: admin.expiresAt,
                    duration: admin.duration
                });
            }
        }

        // นับประวัติ
        stats.expired = data.adminHistory.filter(h => h.removedReason === 'หมดอายุ').length;
        stats.kickedOut = data.adminHistory.filter(h => h.removedReason === 'เตะครบ 5 คน').length;

        return stats;
    } catch (error) {
        console.error('Error getting admin statistics:', error);
        return null;
    }
}

// เริ่มต้นระบบทำความสะอาดอัตโนมัติ
function startAutoCleanup() {
    // ทำความสะอาดทุก 30 นาที
    setInterval(() => {
        cleanupExpiredAdmins();
    }, 30 * 60 * 1000);

    // ทำความสะอาดครั้งแรกเมื่อเริ่มต้น
    cleanupExpiredAdmins();
    
    console.log('[Admin System] เริ่มต้นระบบทำความสะอาดแอดมินอัตโนมัติ');
}

module.exports = {
    cleanupExpiredAdmins,
    getAdminsNearExpiry,
    getAdminStatistics,
    startAutoCleanup
};
