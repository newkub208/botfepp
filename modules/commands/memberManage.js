const axios = require('axios');
const { checkAdminStatus, getMembershipStats, getAllMembers, FIREBASE_URL } = require('../../utils/membershipCheck');

module.exports = {
    name: "จัดการสมาชิก",
    description: "จัดการสมาชิกของบอท (เฉพาะแอดมิน)",
    nashPrefix: true,
    version: "1.0.0",
    role: "admin",
    cooldowns: 5,
    aliases: ["manage", "members", "สมาชิก", "member"],
    
    async execute(api, event, args) {
        const { threadID, messageID, senderID } = event;
        
        // ตรวจสอบสิทธิ์แอดมิน
        const isAdmin = await checkAdminStatus(senderID);
        if (!isAdmin) {
            return api.sendMessage(
                "🚫 คุณไม่มีสิทธิ์ใช้คำสั่งนี้\nเฉพาะแอดมินเท่านั้น",
                threadID, messageID
            );
        }
        
        if (args.length === 0) {
            const stats = await getMembershipStats();
            
            let message = "👥 การจัดการสมาชิก\n";
            message += "═══════════════════\n\n";
            message += `📊 สถิติสมาชิก:\n`;
            message += `• รวมทั้งหมด: ${stats.totalUsers || 0} คน\n`;
            message += `• สมัครวันนี้: ${stats.registrationsToday || 0} คน\n\n`;
            message += "🔧 คำสั่งที่ใช้ได้:\n";
            message += "• จัดการสมาชิก รายชื่อ - ดูรายชื่อสมาชิก\n";
            message += "• จัดการสมาชิก ข้อมูล [UserID] - ดูข้อมูลสมาชิก\n";
            message += "• จัดการสมาชิก แบน [UserID] - แบนสมาชิก\n";
            message += "• จัดการสมาชิก ปลดแบน [UserID] - ปลดแบนสมาชิก\n";
            message += "• จัดการสมาชิก ลบ [UserID] - ลบสมาชิก\n";
            message += "• จัดการสมาชิก สถิติ - ดูสถิติโดยละเอียด";
            
            return api.sendMessage(message, threadID, messageID);
        }
        
        const action = args[0].toLowerCase();
        
        try {
            switch (action) {
                case 'รายชื่อ':
                case 'list':
                    const members = await getAllMembers(20);
                    
                    if (members.length === 0) {
                        return api.sendMessage("ไม่พบสมาชิกในระบบ", threadID, messageID);
                    }
                    
                    let listMessage = `📋 รายชื่อสมาชิก (${members.length} คน)\n`;
                    listMessage += "═══════════════════\n\n";
                    
                    members.forEach((member, index) => {
                        const registeredDate = new Date(member.registeredAt).toLocaleDateString('th-TH');
                        const commandsUsed = member.commandsUsed || 0;
                        
                        listMessage += `${index + 1}. ${member.name}\n`;
                        listMessage += `   ID: ${member.userID}\n`;
                        listMessage += `   สมัคร: ${registeredDate}\n`;
                        listMessage += `   ใช้งาน: ${commandsUsed} ครั้ง\n\n`;
                    });
                    
                    return api.sendMessage(listMessage, threadID, messageID);
                    
                case 'ข้อมูล':
                case 'info':
                    if (args.length < 2) {
                        return api.sendMessage(
                            "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการสมาชิก ข้อมูล 1234567890",
                            threadID, messageID
                        );
                    }
                    
                    const targetUserID = args[1];
                    const userResponse = await axios.get(`${FIREBASE_URL}/users/${targetUserID}.json`);
                    
                    if (!userResponse.data) {
                        return api.sendMessage("❌ ไม่พบสมาชิกที่ระบุ", threadID, messageID);
                    }
                    
                    const userData = userResponse.data;
                    const registeredDate = new Date(userData.registeredAt).toLocaleDateString('th-TH');
                    const lastActiveDate = userData.lastActive ? 
                        new Date(userData.lastActive).toLocaleDateString('th-TH') : 'ไม่เคยใช้งาน';
                    
                    let infoMessage = `👤 ข้อมูลสมาชิก\n`;
                    infoMessage += "═══════════════════\n\n";
                    infoMessage += `📝 ชื่อ: ${userData.name}\n`;
                    infoMessage += `🔗 User ID: ${userData.userID}\n`;
                    infoMessage += `📅 วันที่สมัคร: ${registeredDate}\n`;
                    infoMessage += `⏰ ใช้งานล่าสุด: ${lastActiveDate}\n`;
                    infoMessage += `📊 จำนวนคำสั่งที่ใช้: ${userData.commandsUsed || 0} ครั้ง\n`;
                    infoMessage += `🏠 สมัครจากกลุ่ม: ${userData.registeredFrom || 'ไม่ระบุ'}\n`;
                    infoMessage += `🔥 สถานะ: ${userData.status === 'active' ? '✅ ใช้งานได้' : '❌ ถูกระงับ'}`;
                    
                    return api.sendMessage(infoMessage, threadID, messageID);
                    
                case 'แบน':
                case 'ban':
                    if (args.length < 2) {
                        return api.sendMessage(
                            "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการสมาชิก แบน 1234567890",
                            threadID, messageID
                        );
                    }
                    
                    const banUserID = args[1];
                    const banResponse = await axios.get(`${FIREBASE_URL}/users/${banUserID}.json`);
                    
                    if (!banResponse.data) {
                        return api.sendMessage("❌ ไม่พบสมาชิกที่ระบุ", threadID, messageID);
                    }
                    
                    const banUpdateData = {
                        status: 'banned',
                        bannedAt: new Date().toISOString(),
                        bannedBy: senderID
                    };
                    
                    await axios.patch(`${FIREBASE_URL}/users/${banUserID}.json`, banUpdateData);
                    
                    return api.sendMessage(
                        `🚫 แบนสมาชิก ${banResponse.data.name} แล้ว\n` +
                        `User ID: ${banUserID}\n` +
                        `ผู้ใช้นี้จะไม่สามารถใช้คำสั่งบอทได้อีก`,
                        threadID, messageID
                    );
                    
                case 'ปลดแบน':
                case 'unban':
                    if (args.length < 2) {
                        return api.sendMessage(
                            "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการสมาชิก ปลดแบน 1234567890",
                            threadID, messageID
                        );
                    }
                    
                    const unbanUserID = args[1];
                    const unbanResponse = await axios.get(`${FIREBASE_URL}/users/${unbanUserID}.json`);
                    
                    if (!unbanResponse.data) {
                        return api.sendMessage("❌ ไม่พบสมาชิกที่ระบุ", threadID, messageID);
                    }
                    
                    const unbanUpdateData = {
                        status: 'active',
                        unbannedAt: new Date().toISOString(),
                        unbannedBy: senderID
                    };
                    
                    await axios.patch(`${FIREBASE_URL}/users/${unbanUserID}.json`, unbanUpdateData);
                    
                    return api.sendMessage(
                        `✅ ปลดแบนสมาชิก ${unbanResponse.data.name} แล้ว\n` +
                        `User ID: ${unbanUserID}\n` +
                        `ผู้ใช้นี้สามารถใช้คำสั่งบอทได้อีกครั้ง`,
                        threadID, messageID
                    );
                    
                case 'ลบ':
                case 'delete':
                    if (args.length < 2) {
                        return api.sendMessage(
                            "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการสมาชิก ลบ 1234567890",
                            threadID, messageID
                        );
                    }
                    
                    const deleteUserID = args[1];
                    const deleteResponse = await axios.get(`${FIREBASE_URL}/users/${deleteUserID}.json`);
                    
                    if (!deleteResponse.data) {
                        return api.sendMessage("❌ ไม่พบสมาชิกที่ระบุ", threadID, messageID);
                    }
                    
                    await axios.delete(`${FIREBASE_URL}/users/${deleteUserID}.json`);
                    
                    return api.sendMessage(
                        `🗑️ ลบสมาชิก ${deleteResponse.data.name} แล้ว\n` +
                        `User ID: ${deleteUserID}\n` +
                        `ข้อมูลผู้ใช้นี้ถูกลบออกจากระบบแล้ว`,
                        threadID, messageID
                    );
                    
                case 'สถิติ':
                case 'stats':
                    const detailedStats = await getMembershipStats();
                    const allMembers = await getAllMembers(1000);
                    
                    // คำนวณสถิติเพิ่มเติม
                    const activeMembersToday = allMembers.filter(member => {
                        const lastActive = new Date(member.lastActive || member.registeredAt);
                        const today = new Date();
                        return lastActive.toDateString() === today.toDateString();
                    }).length;
                    
                    const totalCommands = allMembers.reduce((sum, member) => sum + (member.commandsUsed || 0), 0);
                    const avgCommandsPerUser = allMembers.length > 0 ? (totalCommands / allMembers.length).toFixed(2) : 0;
                    
                    let statsMessage = `📊 สถิติระบบสมาชิกโดยละเอียด\n`;
                    statsMessage += "═══════════════════\n\n";
                    statsMessage += `👥 จำนวนสมาชิก:\n`;
                    statsMessage += `• รวมทั้งหมด: ${allMembers.length} คน\n`;
                    statsMessage += `• สมัครวันนี้: ${detailedStats.registrationsToday || 0} คน\n`;
                    statsMessage += `• ใช้งานวันนี้: ${activeMembersToday} คน\n\n`;
                    statsMessage += `📈 การใช้งาน:\n`;
                    statsMessage += `• คำสั่งทั้งหมด: ${totalCommands} ครั้ง\n`;
                    statsMessage += `• เฉลี่ยต่อคน: ${avgCommandsPerUser} ครั้ง\n\n`;
                    statsMessage += `⏰ อัปเดตล่าสุด: ${new Date().toLocaleString('th-TH')}`;
                    
                    return api.sendMessage(statsMessage, threadID, messageID);
                    
                default:
                    return api.sendMessage(
                        "❌ คำสั่งไม่ถูกต้อง\nใช้: จัดการสมาชิก [รายชื่อ/ข้อมูล/แบน/ปลดแบน/ลบ/สถิติ]",
                        threadID, messageID
                    );
            }
        } catch (error) {
            console.error('Error in member management:', error);
            return api.sendMessage(
                `❌ เกิดข้อผิดพลาด: ${error.message}`,
                threadID, messageID
            );
        }
    }
};
