const fs = require('fs');
const path = require('path');

// --- กำหนดค่าคงที่ ---
const SUPER_ADMIN_ID = '61555184860915'; // ไอดีของผู้ใช้ที่มีสิทธิ์สูงสุด
const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json'); // ที่อยู่ของไฟล์เก็บรายชื่อแอดมิน
const ADMIN_DETAILED_PATH = path.join(__dirname, '../../admin_detailed.json'); // ไฟล์เก็บข้อมูลแอดมินแบบละเอียด

// --- ฟังก์ชันสำหรับโหลดรายชื่อแอดมิน (แบบเก่า) ---
function loadAdmins() {
    try {
        if (fs.existsSync(ADMIN_FILE_PATH)) {
            const data = fs.readFileSync(ADMIN_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading admin list:', error);
    }
    return [];
}

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
        superAdmin: SUPER_ADMIN_ID,
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
        fs.writeFileSync(ADMIN_FILE_PATH, JSON.stringify(activeAdmins, null, 2));
    } catch (error) {
        console.error('Error saving detailed admin data:', error);
    }
}

// --- ฟังก์ชันสำหรับบันทึกรายชื่อแอดมิน (แบบเก่า) ---
function saveAdmins(admins) {
    try {
        fs.writeFileSync(ADMIN_FILE_PATH, JSON.stringify(admins, null, 2));
    } catch (error) {
        console.error('Error saving admin list:', error);
    }
}

// --- ฟังก์ชันตรวจสอบและทำความสะอาดแอดมินที่หมดอายุ ---
function cleanupExpiredAdmins() {
    const data = loadDetailedAdmins();
    const now = new Date();
    let hasChanges = false;

    for (const adminId in data.temporaryAdmins) {
        const admin = data.temporaryAdmins[adminId];
        if (new Date(admin.expiresAt) <= now || admin.kickCount >= 5) {
            // บันทึกประวัติก่อนลบ
            data.adminHistory.push({
                adminId: adminId,
                addedAt: admin.addedAt,
                addedBy: admin.addedBy,
                removedAt: new Date().toISOString(),
                removedReason: admin.kickCount >= 5 ? 'เตะครบ 5 คน' : 'หมดอายุ',
                kickCount: admin.kickCount,
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

// --- ฟังก์ชันแปลงเวลา ---
function parseDuration(durationStr) {
    const match = durationStr.match(/(\d+)(นาที|ชั่วโมง|วัน|m|h|d)/i);
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    const now = new Date();
    
    if (unit === 'นาที' || unit === 'm') {
        now.setMinutes(now.getMinutes() + value);
    } else if (unit === 'ชั่วโมง' || unit === 'h') {
        now.setHours(now.getHours() + value);
    } else if (unit === 'วัน' || unit === 'd') {
        now.setDate(now.getDate() + value);
    }
    
    return now;
}

module.exports = {
    name: "เพิ่มแอดมิน",
    description: "เพิ่มผู้ใช้เป็นแอดมินชั่วคราวของบอท (สำหรับแอดมินเท่านั้น)",
    version: "2.0.0",
    aliases: ["addadmin", "setadmin", "add-admin", "admin-add", "makeadmin"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, type, messageReply } = event;

        // ทำความสะอาดแอดมินที่หมดอายุก่อน
        cleanupExpiredAdmins();

        const detailedData = loadDetailedAdmins();

        // --- 1. ตรวจสอบสิทธิ์ผู้ใช้งาน ---
        const isTemporaryAdmin = detailedData.temporaryAdmins[senderID] && 
                                detailedData.temporaryAdmins[senderID].isActive &&
                                new Date(detailedData.temporaryAdmins[senderID].expiresAt) > new Date();
        
        if (senderID !== SUPER_ADMIN_ID && !isTemporaryAdmin) {
            return api.sendMessage("❌ คำสั่งนี้สำหรับแอดมินเท่านั้น", threadID, messageID);
        }

        // --- 2. หาเป้าหมาย ระยะเวลา และจำนวนการเตะ ---
        let targetID = "";
        let duration = "1วัน"; // ค่าเริ่มต้น
        let maxKicks = detailedData.defaultMaxKicks || 5; // ใช้ค่าเริ่มต้นจากระบบ
        
        if (type === "message_reply") {
            targetID = messageReply.senderID;
            if (args.length > 0) {
                // แยกพารามิเตอร์ เวลา และจำนวนการเตะ
                const params = args.join(' ').split(' ');
                duration = params[0] || "1วัน";
                
                // ตรวจสอบพารามิเตอร์ที่สอง ว่าเป็นจำนวนการเตะหรือไม่
                if (params[1] && /^\d+$/.test(params[1])) {
                    maxKicks = parseInt(params[1]);
                }
            }
        } else if (args.length > 0 && /^\d+$/.test(args[0])) {
            targetID = args[0];
            if (args.length > 1) {
                const params = args.slice(1);
                duration = params[0] || "1วัน";
                
                // ตรวจสอบพารามิเตอร์ที่สาม ว่าเป็นจำนวนการเตะหรือไม่
                if (params[1] && /^\d+$/.test(params[1])) {
                    maxKicks = parseInt(params[1]);
                }
            }
        } else {
            return api.sendMessage(
                `📝 วิธีใช้คำสั่ง:\n` +
                `• ตอบกลับข้อความแล้วพิมพ์ ${prefix}เพิ่มแอดมิน [เวลา] [จำนวนเตะ]\n` +
                `• พิมพ์ ${prefix}เพิ่มแอดมิน [UID] [เวลา] [จำนวนเตะ]\n\n` +
                `⏰ ตัวอย่างเวลา:\n` +
                `• 30นาที, 2ชั่วโมง, 7วัน\n` +
                `• 30m, 2h, 7d\n\n` +
                `🚫 จำนวนการเตะ:\n` +
                `• ตัวเลข 1-100 (ค่าเริ่มต้น: 5)\n\n` +
                `🔍 ตัวอย่าง:\n` +
                `${prefix}เพิ่มแอดมิน 61574221880222 1วัน 10\n` +
                `${prefix}เพิ่มแอดมิน 61574221880222 2ชั่วโมง 3`,
                threadID,
                messageID
            );
        }

        // ตรวจสอบจำนวนการเตะ
        if (maxKicks < 1 || maxKicks > 100) {
            return api.sendMessage(
                `❌ จำนวนการเตะต้องอยู่ระหว่าง 1-100\n` +
                `📊 คุณใส่: ${maxKicks}`,
                threadID,
                messageID
            );
        }

        // --- 3. จัดการระยะเวลา ---
        const expiresAt = parseDuration(duration);
        if (!expiresAt) {
            return api.sendMessage(
                `❌ รูปแบบเวลาไม่ถูกต้อง\n\n` +
                `✅ รูปแบบที่ถูกต้อง:\n` +
                `• นาที: 30นาที หรือ 30m\n` +
                `• ชั่วโมง: 2ชั่วโมง หรือ 2h\n` +
                `• วัน: 7วัน หรือ 7d`,
                threadID,
                messageID
            );
        }

        // ตรวจสอบระยะเวลาสูงสุด (สำหรับแอดมินชั่วคราว)
        if (senderID !== SUPER_ADMIN_ID) {
            const maxTime = new Date();
            maxTime.setDate(maxTime.getDate() + 30); // สูงสุด 30 วัน
            
            if (expiresAt > maxTime) {
                return api.sendMessage(
                    `❌ แอดมินชั่วคราวสามารถตั้งเวลาได้สูงสุด 30 วันเท่านั้น\n` +
                    `⏰ คุณพยายามตั้งเวลา: ${duration}`,
                    threadID,
                    messageID
                );
            }
        }
        
        // --- 4. จัดการข้อมูลแอดมิน ---
        try {
            // ตรวจสอบว่าเป้าหมายเป็น Super Admin หรือไม่
            if (targetID === SUPER_ADMIN_ID) {
                return api.sendMessage("❌ ไม่สามารถเพิ่มผู้ดูแลสูงสุดซ้ำได้", threadID, messageID);
            }

            // ตรวจสอบว่าเป้าหมายเป็นแอดมินอยู่แล้วหรือไม่
            if (detailedData.temporaryAdmins[targetID] && 
                detailedData.temporaryAdmins[targetID].isActive &&
                new Date(detailedData.temporaryAdmins[targetID].expiresAt) > new Date()) {
                
                // อัพเดทข้อมูลแอดมิน
                detailedData.temporaryAdmins[targetID].expiresAt = expiresAt.toISOString();
                detailedData.temporaryAdmins[targetID].duration = duration;
                detailedData.temporaryAdmins[targetID].maxKicks = maxKicks;
                detailedData.temporaryAdmins[targetID].lastUpdated = new Date().toISOString();
                detailedData.temporaryAdmins[targetID].updatedBy = senderID;
                
                saveDetailedAdmins(detailedData);
                
                const userInfo = await api.getUserInfo(targetID);
                const targetName = userInfo[targetID]?.name || `ผู้ใช้ UID: ${targetID}`;
                
                return api.sendMessage(
                    `✅ อัพเดทแอดมิน "${targetName}" เรียบร้อยแล้ว\n\n` +
                    `⏰ เวลาใหม่: ${duration}\n` +
                    `📅 หมดอายุ: ${expiresAt.toLocaleString('th-TH')}\n` +
                    `🚫 จำนวนการเตะ: ${detailedData.temporaryAdmins[targetID].kickCount}/${maxKicks} ครั้ง\n` +
                    `📊 การเตะที่เหลือ: ${maxKicks - detailedData.temporaryAdmins[targetID].kickCount} ครั้ง`,
                    threadID,
                    messageID
                );
            }

            // เพิ่มแอดมินใหม่
            detailedData.temporaryAdmins[targetID] = {
                addedAt: new Date().toISOString(),
                addedBy: senderID,
                expiresAt: expiresAt.toISOString(),
                duration: duration,
                maxKicks: maxKicks,
                kickCount: 0,
                isActive: true,
                lastUpdated: new Date().toISOString()
            };

            saveDetailedAdmins(detailedData);

            // ดึงชื่อผู้ใช้เพื่อแสดงในข้อความตอบกลับ
            const userInfo = await api.getUserInfo(targetID);
            const targetName = userInfo[targetID]?.name || `ผู้ใช้ UID: ${targetID}`;

            api.sendMessage(
                `✅ แต่งตั้ง "${targetName}" เป็นแอดมินชั่วคราวเรียบร้อยแล้ว\n\n` +
                `⏰ ระยะเวลา: ${duration}\n` +
                `📅 หมดอายุ: ${expiresAt.toLocaleString('th-TH')}\n` +
                `🚫 สิทธิ์เตะ: 0/${maxKicks} ครั้ง\n` +
                `📊 การเตะที่เหลือ: ${maxKicks} ครั้ง\n\n` +
                `⚠️ หมายเหตุ:\n` +
                `• เตะได้สูงสุด ${maxKicks} คน\n` +
                `• หากเตะครบ ${maxKicks} คน จะถูกลบออกทันที\n` +
                `• หากหมดเวลา จะถูกลบออกอัตโนมัติ`,
                threadID,
                messageID
            );

        } catch (err) {
            console.error("Add admin command error:", err);
            api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการเพิ่มแอดมิน\n` +
                `🔧 Error: ${err.message}`,
                threadID,
                messageID
            );
        }
    }
};
