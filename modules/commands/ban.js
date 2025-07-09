const fs = require('fs');
const path = require('path');

// --- กำหนดค่าคงที่ ---
const SUPER_ADMIN_ID = '61555184860915'; // ไอดีของผู้ใช้ที่มีสิทธิ์สูงสุด
const ADMIN_FILE_PATH = path.join(__dirname, '../../admin_list.json'); // ที่อยู่ของไฟล์เก็บรายชื่อแอดมิน
const BAN_FILE_PATH = path.join(__dirname, '../../ban_list.json'); // ที่อยู่ของไฟล์เก็บรายชื่อผู้ใช้ที่ถูกแบน

// --- ฟังก์ชันสำหรับโหลดรายชื่อแอดมิน ---
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

// --- ฟังก์ชันสำหรับโหลดรายชื่อผู้ใช้ที่ถูกแบน ---
function loadBannedUsers() {
    try {
        if (fs.existsSync(BAN_FILE_PATH)) {
            const data = fs.readFileSync(BAN_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading ban list:', error);
    }
    return {};
}

// --- ฟังก์ชันสำหรับบันทึกรายชื่อผู้ใช้ที่ถูกแบน ---
function saveBannedUsers(bannedUsers) {
    try {
        fs.writeFileSync(BAN_FILE_PATH, JSON.stringify(bannedUsers, null, 2));
    } catch (error) {
        console.error('Error saving ban list:', error);
    }
}

// --- ฟังก์ชันแปลงระยะเวลาเป็นมิลลิวินาที ---
function parseTimeToMs(timeString) {
    const timeRegex = /^(\d+)(นาที|ชั่วโมง|วัน|m|h|d)$/i;
    const match = timeString.match(timeRegex);
    
    if (!match) return null;
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    // ตรวจสอบขีดจำกัดเวลา
    if ((unit === 'นาที' || unit === 'm') && value < 1) return null;
    if ((unit === 'วัน' || unit === 'd') && value > 30) return null;
    
    switch (unit) {
        case 'นาที':
        case 'm':
            return value * 60 * 1000;
        case 'ชั่วโมง':
        case 'h':
            return value * 60 * 60 * 1000;
        case 'วัน':
        case 'd':
            return value * 24 * 60 * 60 * 1000;
        default:
            return null;
    }
}

// --- ฟังก์ชันแยกข้อมูลจาก args ---
function parseArgs(args) {
    let targetID = "";
    let reason = "ไม่ได้ระบุเหตุผล";
    let duration = "ถาวร";
    
    if (args.length === 0) return { targetID, reason, duration };
    
    // ดึง targetID (รองรับทั้ง @ และ UID)
    if (args[0].startsWith('@')) {
        targetID = args[0].substring(1);
    } else if (/^\d+$/.test(args[0])) {
        targetID = args[0];
    } else {
        // หากไม่ใช่ @ หรือ UID ให้หาคำที่เป็นตัวเลขใน args
        for (let i = 0; i < args.length; i++) {
            if (/^\d+$/.test(args[i])) {
                targetID = args[i];
                // ลบ targetID ออกจาก args และปรับ args ใหม่
                args = [...args.slice(0, i), ...args.slice(i + 1)];
                break;
            }
        }
        // หากยังไม่พบ targetID ให้ใช้ args[0] แทน
        if (!targetID) {
            targetID = args[0].replace(/[@]/g, '');
            args = args.slice(1);
        } else {
            // หากพบ targetID แล้ว ไม่ต้องเอา args[0] ออก
        }
    }
    
    // หากมีเพียง targetID เดียว
    if (args.length <= 1 && targetID) return { targetID, reason, duration };
    
    // หากไม่ได้เอา args[0] ออกยัง ให้เอาออก
    if (args.length > 0 && (args[0].startsWith('@') || /^\d+$/.test(args[0]))) {
        args = args.slice(1);
    }
    
    if (args.length === 0) return { targetID, reason, duration };
    
    // ตรวจสอบว่ามีคำว่า "เหตุ" และ "เวลา" หรือไม่
    const reasonIndex = args.findIndex(arg => arg.toLowerCase() === 'เหตุ');
    const timeIndex = args.findIndex(arg => arg.toLowerCase() === 'เวลา');
    
    if (reasonIndex !== -1 && timeIndex !== -1) {
        // มีทั้ง "เหตุ" และ "เวลา"
        reason = args.slice(reasonIndex + 1, timeIndex).join(' ');
        duration = args.slice(timeIndex + 1).join(' ');
    } else if (reasonIndex !== -1) {
        // มีเฉพาะ "เหตุ"
        reason = args.slice(reasonIndex + 1).join(' ');
        duration = "ถาวร";
    } else if (timeIndex !== -1) {
        // มีเฉพาะ "เวลา"
        reason = args.slice(0, timeIndex).join(' ');
        duration = args.slice(timeIndex + 1).join(' ');
    } else {
        // ไม่มีคำว่า "เหตุ" หรือ "เวลา" ใช้วิธีเดิม
        // หาตำแหน่งของเวลา (ตัวสุดท้ายที่มีรูปแบบเวลา)
        let autoTimeIndex = -1;
        for (let i = args.length - 1; i >= 0; i--) {
            if (/^(\d+)(นาที|ชั่วโมง|วัน|m|h|d)$/i.test(args[i]) || args[i].toLowerCase() === 'ถาวร') {
                autoTimeIndex = i;
                break;
            }
        }
        
        if (autoTimeIndex !== -1) {
            // มีเวลาระบุ
            duration = args[autoTimeIndex];
            if (autoTimeIndex > 0) {
                reason = args.slice(0, autoTimeIndex).join(' ');
            }
        } else {
            // ไม่มีเวลาระบุ ถือว่าทั้งหมดเป็นเหตุผล
            reason = args.join(' ');
        }
    }
    
    // ตรวจสอบว่าเหตุผลและเวลาไม่ว่าง
    if (reason.trim() === '') reason = "ไม่ได้ระบุเหตุผล";
    if (duration.trim() === '') duration = "ถาวร";
    
    return { targetID, reason, duration };
}

// --- ฟังก์ชันตรวจสอบสิทธิ์ ---
function hasPermission(senderID) {
    const admins = loadAdmins();
    return senderID === SUPER_ADMIN_ID || admins.includes(senderID);
}

module.exports = {
    name: "ban",
    description: "แบนผู้ใช้ออกจากกลุ่ม (สำหรับแอดมินเท่านั้น)",
    version: "1.0.0",
    aliases: ["แบน"],
    nashPrefix: false,
    cooldowns: 3,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, type, messageReply } = event;

        // --- 1. ตรวจสอบสิทธิ์ผู้ใช้งาน ---
        if (!hasPermission(senderID)) {
            return api.sendMessage("คำสั่งนี้สำหรับแอดมินเท่านั้นครับ", threadID, messageID);
        }

        // --- 2. หาเป้าหมายที่จะแบน ---
        let targetID = "";
        let reason = "";
        let duration = "";
        
        if (type === "message_reply") {
            targetID = messageReply.senderID;
            
            if (args.length > 0) {
                const parsed = parseArgs(['dummy', ...args]); // เพิ่ม dummy เพื่อให้ parseArgs ทำงานถูกต้อง
                reason = parsed.reason;
                duration = parsed.duration;
            } else {
                reason = "ไม่ได้ระบุเหตุผล";
                duration = "ถาวร";
            }
        } else if (args.length > 0) {
            const parsed = parseArgs(args);
            targetID = parsed.targetID;
            reason = parsed.reason;
            duration = parsed.duration;
            
            // Debug: แสดงข้อมูลที่แยกได้ (เฉพาะในโหมดพัฒนา)
            console.log('Ban Debug - Parsed data:', {
                originalArgs: args,
                targetID,
                reason,
                duration
            });
        } else {
            return api.sendMessage(
                `🚫 วิธีใช้คำสั่งแบน:\n\n` +
                `📌 รูปแบบการใช้:\n` +
                `• ${prefix}ban @user [เหตุผล] [เวลา]\n` +
                `• ${prefix}ban @user เหตุ [เหตุผล] เวลา [เวลา]\n` +
                `• ${prefix}ban [UID] [เหตุผล] [เวลา]\n` +
                `• ตอบกลับข้อความแล้วพิมพ์ ${prefix}ban [เหตุผล] [เวลา]\n` +
                `• ตอบกลับข้อความแล้วพิมพ์ ${prefix}ban เหตุ [เหตุผล] เวลา [เวลา]\n\n` +
                `⏰ ระยะเวลา: 1นาที-30วัน หรือ ถาวร\n\n` +
                `💡 ตัวอย่าง:\n` +
                `• ${prefix}ban @user ปัญญาอ่อน 1วัน\n` +
                `• ${prefix}ban @user เหตุ สแปม เวลา 2ชั่วโมง\n` +
                `• ${prefix}ban @user ใช้คำหยาบ ถาวร\n` +
                `• ${prefix}ban @user (แบนถาวรโดยไม่ระบุเหตุผล)\n` +
                `• ตอบกลับแล้วพิมพ์ ${prefix}ban เหตุ ปัญญาอ่อน เวลา 1วัน`,
                threadID,
                messageID
            );
        }

        // --- 3. ตรวจสอบความถูกต้องของ targetID ---
        if (!targetID) {
            return api.sendMessage("❌ ไม่พบผู้ใช้ที่ต้องการแบน\nกรุณาระบุ @user หรือ UID ของผู้ใช้", threadID, messageID);
        }
        
        // ตรวจสอบว่า targetID เป็นตัวเลขหรือไม่
        if (!/^\d+$/.test(targetID)) {
            return api.sendMessage("❌ UID ไม่ถูกต้อง\nUID ต้องเป็นตัวเลขเท่านั้น", threadID, messageID);
        }

        // --- 4. ตรวจสอบว่าไม่สามารถแบนตัวเองหรือแอดมินได้ ---
        if (targetID === senderID) {
            return api.sendMessage("คุณไม่สามารถแบนตัวเองได้", threadID, messageID);
        }

        if (targetID === SUPER_ADMIN_ID || loadAdmins().includes(targetID)) {
            return api.sendMessage("ไม่สามารถแบนแอดมินได้", threadID, messageID);
        }

        // --- 5. จัดการข้อมูลการแบน ---
        try {
            const bannedUsers = loadBannedUsers();
            
            // ตรวจสอบว่าผู้ใช้ถูกแบนอยู่แล้วหรือไม่
            if (bannedUsers[targetID]) {
                return api.sendMessage(`❌ ผู้ใช้นี้ถูกแบนอยู่แล้ว\nใช้คำสั่ง ${prefix}unban เพื่อปลดแบนก่อน`, threadID, messageID);
            }
            
            let banUntil = null;
            
            // คำนวณเวลาหมดอายุการแบน
            if (duration !== "ถาวร") {
                const durationMs = parseTimeToMs(duration);
                if (durationMs) {
                    banUntil = Date.now() + durationMs;
                } else {
                    return api.sendMessage(
                        `❌ รูปแบบเวลาไม่ถูกต้อง\n\n` +
                        `✅ รูปแบบที่ถูกต้อง:\n` +
                        `• 1นาที - 59นาที\n` +
                        `• 1ชั่วโมง - 23ชั่วโมง\n` +
                        `• 1วัน - 30วัน\n` +
                        `• ถาวร`,
                        threadID,
                        messageID
                    );
                }
            }

            // บันทึกข้อมูลการแบน
            bannedUsers[targetID] = {
                reason: reason,
                bannedBy: senderID,
                bannedAt: Date.now(),
                banUntil: banUntil,
                threadID: threadID
            };

            saveBannedUsers(bannedUsers);

            // ดึงชื่อผู้ใช้เพื่อแสดงในข้อความตอบกลับ
            const userInfo = await api.getUserInfo(targetID);
            const targetName = userInfo[targetID]?.name || `ผู้ใช้ UID: ${targetID}`;

            const banMessage = `🚫 แบน "${targetName}" เรียบร้อยแล้ว\n\n` +
                `📝 เหตุผล: ${reason}\n` +
                `⏰ ระยะเวลา: ${duration}\n` +
                `👤 ถูกแบนโดย: ${senderID}\n` +
                `📅 วันที่แบน: ${new Date().toLocaleString('th-TH')}\n\n` +
                `⚠️ จะดำเนินการเตะออกจากกลุ่มในอีก 20 วินาที`;

            api.sendMessage(banMessage, threadID, messageID);

            // รอ 20 วินาทีก่อนเตะผู้ใช้ออก
            setTimeout(async () => {
                try {
                    // ตรวจสอบว่าผู้ใช้ยังอยู่ในกลุ่มหรือไม่
                    const threadInfo = await api.getThreadInfo(threadID);
                    const participantIDs = threadInfo.participantIDs || [];
                    
                    if (!participantIDs.includes(targetID)) {
                        api.sendMessage(`ℹ️ "${targetName}" ออกจากกลุ่มไปแล้ว`, threadID);
                        return;
                    }
                    
                    // ตรวจสอบสิทธิ์ของบอท
                    const botID = api.getCurrentUserID();
                    const adminIDs = threadInfo.adminIDs || [];
                    const isBotAdmin = adminIDs.some(admin => admin.id === botID);
                    
                    if (!isBotAdmin) {
                        api.sendMessage(
                            `⚠️ ไม่สามารถเตะ "${targetName}" ออกจากกลุ่มได้\n` +
                            `❌ เหตุผล: บอทไม่มีสิทธิ์แอดมินในกลุ่มนี้\n` +
                            `💡 แนะนำ: ให้แอดมินเตะผู้ใช้ดังกล่าวออกด้วยตนเอง`,
                            threadID
                        );
                        return;
                    }
                    
                    // เตะผู้ใช้ออก
                    await api.removeUserFromGroup(targetID, threadID);
                    api.sendMessage(`✅ เตะ "${targetName}" ออกจากกลุ่มเรียบร้อยแล้ว`, threadID);
                    
                } catch (error) {
                    console.error('Error removing user from group:', error);
                    
                    let errorMessage = `❌ ไม่สามารถเตะ "${targetName}" ออกจากกลุ่มได้\n`;
                    
                    if (error.message && error.message.includes('permission')) {
                        errorMessage += `🔐 เหตุผล: ไม่มีสิทธิ์เตะผู้ใช้\n`;
                        errorMessage += `💡 แนะนำ: ตรวจสอบสิทธิ์แอดมินของบอท`;
                    } else if (error.message && error.message.includes('not found')) {
                        errorMessage += `👤 เหตุผล: ไม่พบผู้ใช้ในกลุ่ม (อาจออกไปแล้ว)`;
                    } else {
                        errorMessage += `⚙️ เหตุผล: ${error.message || 'ข้อผิดพลาดไม่ทราบสาเหตุ'}\n`;
                        errorMessage += `💡 แนะนำ: ลองเตะผู้ใช้ออกด้วยตนเอง`;
                    }
                    
                    api.sendMessage(errorMessage, threadID);
                }
            }, 20000); // 20 วินาที

        } catch (err) {
            console.error("Ban command error:", err);
            api.sendMessage("❌ เกิดข้อผิดพลาดในการแบนผู้ใช้", threadID, messageID);
        }
    }
};
