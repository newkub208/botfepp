const { getMemberInfo, getStats, FIREBASE_URL } = require('../../utils/memberUtils');
const axios = require('axios');

module.exports = {
    name: "จัดการสมาชิก",
    description: "จัดการสมาชิกของบอท (เฉพาะแอดมิน)",
    nashPrefix: true,
    version: "1.0.0",
    role: "admin",
    cooldowns: 3,
    aliases: ["manage", "จัดการ", "admin"],
    
    async execute(api, event, args) {
        const { threadID, messageID, senderID } = event;
        
        if (args.length === 0) {
            // แสดงสถิติและคำสั่งที่ใช้ได้
            const stats = await getStats();
            
            let message = "👑 แผงควบคุมแอดมิน\n";
            message += "═══════════════════\n\n";
            
            if (stats) {
                message += `📊 สถิติระบบ:\n`;
                message += `• สมาชิกทั้งหมด: ${stats.totalUsers} คน\n`;
                message += `• สมาชิกที่ใช้งานได้: ${stats.activeUsers} คน\n`;
                message += `• สมัครวันนี้: ${stats.registrationsToday} คน\n\n`;
            }
            
            message += "🔧 คำสั่งที่ใช้ได้:\n";
            message += "• จัดการสมาชิก ข้อมูล [userID] - ดูข้อมูลสมาชิก\n";
            message += "• จัดการสมาชิก ระงับ [userID] - ระงับสมาชิก\n";
            message += "• จัดการสมาชิก ยกเลิกระงับ [userID] - ยกเลิกการระงับ\n";
            message += "• จัดการสมาชิก ลบ [userID] - ลบสมาชิก\n";
            message += "• จัดการสมาชิก สถิติ - ดูสถิติทั้งหมด\n";
            message += "• จัดการสมาชิก รายชื่อ - ดูรายชื่อสมาชิกล่าสุด";
            
            return api.sendMessage(message, threadID, messageID);
        }
        
        const action = args[0].toLowerCase();
        const targetUserID = args[1];
        
        switch (action) {
            case 'ข้อมูล':
            case 'info':
                if (!targetUserID) {
                    return api.sendMessage(
                        "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการสมาชิก ข้อมูล 1234567890",
                        threadID, messageID
                    );
                }
                
                const memberInfo = await getMemberInfo(targetUserID);
                if (!memberInfo) {
                    return api.sendMessage(
                        `❌ ไม่พบสมาชิกที่มี ID: ${targetUserID}`,
                        threadID, messageID
                    );
                }
                
                const registeredDate = new Date(memberInfo.registeredAt).toLocaleString('th-TH');
                const lastActiveDate = memberInfo.lastActive ? new Date(memberInfo.lastActive).toLocaleString('th-TH') : 'ไม่มีข้อมูล';
                
                let infoMessage = `👤 ข้อมูลสมาชิก\n`;
                infoMessage += `═══════════════════\n\n`;
                infoMessage += `📝 ชื่อ: ${memberInfo.name}\n`;
                infoMessage += `🆔 User ID: ${memberInfo.userID}\n`;
                infoMessage += `📊 สถานะ: ${memberInfo.status === 'active' ? '🟢 ใช้งานได้' : '🔴 ถูกระงับ'}\n`;
                infoMessage += `📅 สมัครเมื่อ: ${registeredDate}\n`;
                infoMessage += `⏰ ใช้งานล่าสุด: ${lastActiveDate}\n`;
                infoMessage += `🔢 ใช้คำสั่งไปแล้ว: ${memberInfo.commandsUsed || 0} ครั้ง\n`;
                infoMessage += `📍 สมัครจากกลุ่ม: ${memberInfo.registeredFrom || 'ไม่มีข้อมูล'}`;
                
                return api.sendMessage(infoMessage, threadID, messageID);
                
            case 'ระงับ':
            case 'suspend':
            case 'ban':
                if (!targetUserID) {
                    return api.sendMessage(
                        "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการสมาชิก ระงับ 1234567890",
                        threadID, messageID
                    );
                }
                
                try {
                    const updateData = {
                        status: 'suspended',
                        suspendedAt: new Date().toISOString(),
                        suspendedBy: senderID
                    };
                    
                    await axios.patch(`${FIREBASE_URL}/users/${targetUserID}.json`, updateData);
                    
                    return api.sendMessage(
                        `✅ ระงับสมาชิก ${targetUserID} เรียบร้อยแล้ว\n\n` +
                        "สมาชิกนี้จะไม่สามารถใช้คำสั่งใดๆ ได้จนกว่าจะยกเลิกการระงับ",
                        threadID, messageID
                    );
                } catch (error) {
                    return api.sendMessage(
                        `❌ เกิดข้อผิดพลาดในการระงับสมาชิก: ${error.message}`,
                        threadID, messageID
                    );
                }
                
            case 'ยกเลิกระงับ':
            case 'unsuspend':
            case 'unban':
                if (!targetUserID) {
                    return api.sendMessage(
                        "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการสมาชิก ยกเลิกระงับ 1234567890",
                        threadID, messageID
                    );
                }
                
                try {
                    const updateData = {
                        status: 'active',
                        unsuspendedAt: new Date().toISOString(),
                        unsuspendedBy: senderID
                    };
                    
                    await axios.patch(`${FIREBASE_URL}/users/${targetUserID}.json`, updateData);
                    
                    return api.sendMessage(
                        `✅ ยกเลิกการระงับสมาชิก ${targetUserID} เรียบร้อยแล้ว\n\n` +
                        "สมาชิกนี้สามารถใช้คำสั่งต่างๆ ได้อีกครั้ง",
                        threadID, messageID
                    );
                } catch (error) {
                    return api.sendMessage(
                        `❌ เกิดข้อผิดพลาดในการยกเลิกระงับ: ${error.message}`,
                        threadID, messageID
                    );
                }
                
            case 'ลบ':
            case 'delete':
            case 'remove':
                if (!targetUserID) {
                    return api.sendMessage(
                        "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการสมาชิก ลบ 1234567890",
                        threadID, messageID
                    );
                }
                
                try {
                    await axios.delete(`${FIREBASE_URL}/users/${targetUserID}.json`);
                    
                    return api.sendMessage(
                        `✅ ลบสมาชิก ${targetUserID} เรียบร้อยแล้ว\n\n` +
                        "ข้อมูลสมาชิกนี้ถูกลบออกจากระบบแล้ว",
                        threadID, messageID
                    );
                } catch (error) {
                    return api.sendMessage(
                        `❌ เกิดข้อผิดพลาดในการลบสมาชิก: ${error.message}`,
                        threadID, messageID
                    );
                }
                
            case 'สถิติ':
            case 'stats':
                const detailedStats = await getStats();
                if (!detailedStats) {
                    return api.sendMessage(
                        "❌ ไม่สามารถดึงข้อมูลสถิติได้",
                        threadID, messageID
                    );
                }
                
                let statsMessage = `📊 สถิติระบบสมาชิก\n`;
                statsMessage += `═══════════════════\n\n`;
                statsMessage += `👥 สมาชิกทั้งหมด: ${detailedStats.totalUsers} คน\n`;
                statsMessage += `🟢 สมาชิกที่ใช้งานได้: ${detailedStats.activeUsers} คน\n`;
                statsMessage += `🔴 สมาชิกที่ถูกระงับ: ${detailedStats.totalUsers - detailedStats.activeUsers} คน\n`;
                statsMessage += `📅 สมัครวันนี้: ${detailedStats.registrationsToday} คน\n`;
                statsMessage += `⏰ อัปเดตล่าสุด: ${detailedStats.lastUpdate ? new Date(detailedStats.lastUpdate).toLocaleString('th-TH') : 'ไม่มีข้อมูล'}`;
                
                return api.sendMessage(statsMessage, threadID, messageID);
                
            case 'รายชื่อ':
            case 'list':
                try {
                    const usersResponse = await axios.get(`${FIREBASE_URL}/users.json`);
                    const users = usersResponse.data || {};
                    
                    if (Object.keys(users).length === 0) {
                        return api.sendMessage(
                            "📝 ยังไม่มีสมาชิกในระบบ",
                            threadID, messageID
                        );
                    }
                    
                    const userList = Object.values(users)
                        .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
                        .slice(0, 10); // แสดงเฉพาะ 10 คนล่าสุด
                    
                    let listMessage = `📝 รายชื่อสมาชิกล่าสุด (${userList.length}/${Object.keys(users).length})\n`;
                    listMessage += `═══════════════════\n\n`;
                    
                    userList.forEach((user, index) => {
                        const status = user.status === 'active' ? '🟢' : '🔴';
                        const date = new Date(user.registeredAt).toLocaleDateString('th-TH');
                        listMessage += `${index + 1}. ${status} ${user.name}\n`;
                        listMessage += `   ID: ${user.userID} | ${date}\n\n`;
                    });
                    
                    if (Object.keys(users).length > 10) {
                        listMessage += `... และอีก ${Object.keys(users).length - 10} คน`;
                    }
                    
                    return api.sendMessage(listMessage, threadID, messageID);
                } catch (error) {
                    return api.sendMessage(
                        `❌ เกิดข้อผิดพลาดในการดึงรายชื่อ: ${error.message}`,
                        threadID, messageID
                    );
                }
                
            default:
                return api.sendMessage(
                    "❌ คำสั่งไม่ถูกต้อง\nใช้: จัดการสมาชิก [ข้อมูล/ระงับ/ยกเลิกระงับ/ลบ/สถิติ/รายชื่อ]",
                    threadID, messageID
                );
        }
    }
};
