const authManager = require('../../utils/authManager');

module.exports = {
    name: "จัดการผู้ใช้",
    description: "จัดการผู้ใช้ในระบบ (เฉพาะ Admin)",
    nashPrefix: true,
    version: "1.0.0",
    role: "admin",
    cooldowns: 3,
    aliases: ["usermanage", "admin", "ผู้ใช้"],
    
    async execute(api, event, args) {
        const { threadID, messageID, senderID } = event;
        
        if (args.length === 0) {
            let message = "👑 การจัดการผู้ใช้ (Admin)\n";
            message += "═══════════════════\n\n";
            message += "📋 คำสั่งที่ใช้ได้:\n";
            message += "• จัดการผู้ใช้ รายชื่อ - ดูรายชื่อผู้ใช้ทั้งหมด\n";
            message += "• จัดการผู้ใช้ session - ดู session ที่ใช้งานอยู่\n";
            message += "• จัดการผู้ใช้ รีเซ็ต [userID] - รีเซ็ตรหัสผ่านผู้ใช้\n";
            message += "• จัดการผู้ใช้ ระงับ [userID] - ระงับการใช้งาน\n";
            message += "• จัดการผู้ใช้ เปิด [userID] - เปิดการใช้งาน\n";
            message += "• จัดการผู้ใช้ ลบ [userID] - ลบผู้ใช้\n";
            message += "• จัดการผู้ใช้ ล้าง - ล้าง session ที่หมดอายุ\n\n";
            message += "⚠️ หมายเหตุ: คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลระบบเท่านั้น!";
            
            return api.sendMessage(message, threadID, messageID);
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'รายชื่อ':
            case 'list':
            case 'users':
                const usersResult = await authManager.getAllUsers();
                if (!usersResult.success) {
                    return api.sendMessage(
                        `❌ ไม่สามารถดึงข้อมูลผู้ใช้ได้: ${usersResult.error}`,
                        threadID, messageID
                    );
                }
                
                const users = usersResult.users;
                if (users.length === 0) {
                    return api.sendMessage(
                        "📋 ไม่มีผู้ใช้ในระบบ",
                        threadID, messageID
                    );
                }
                
                let userList = "📋 รายชื่อผู้ใช้ทั้งหมด\n";
                userList += "═══════════════════\n\n";
                
                users.forEach((user, index) => {
                    const lastLogin = user.lastLogin ? 
                        new Date(user.lastLogin).toLocaleString('th-TH') : 'ยังไม่เคยเข้าสู่ระบบ';
                    const status = user.isActive ? '🟢 ใช้งานได้' : '🔴 ระงับ';
                    
                    userList += `${index + 1}. ${user.username}\n`;
                    userList += `   ID: ${user.userID}\n`;
                    userList += `   สถานะ: ${status}\n`;
                    userList += `   เข้าสู่ระบบล่าสุด: ${lastLogin}\n`;
                    userList += `   จำนวนครั้งที่เข้า: ${user.loginCount} ครั้ง\n\n`;
                });
                
                return api.sendMessage(userList, threadID, messageID);
                
            case 'session':
            case 'sessions':
                const sessionsResult = await authManager.getActiveSessions();
                if (!sessionsResult.success) {
                    return api.sendMessage(
                        `❌ ไม่สามารถดึงข้อมูล session ได้: ${sessionsResult.error}`,
                        threadID, messageID
                    );
                }
                
                const sessions = sessionsResult.sessions;
                if (sessions.length === 0) {
                    return api.sendMessage(
                        "📱 ไม่มี session ที่ใช้งานอยู่",
                        threadID, messageID
                    );
                }
                
                let sessionList = "📱 Session ที่ใช้งานอยู่\n";
                sessionList += "═══════════════════\n\n";
                
                sessions.forEach((session, index) => {
                    const loginTime = new Date(session.loginTime).toLocaleString('th-TH');
                    const expiresAt = new Date(session.expiresAt).toLocaleString('th-TH');
                    
                    sessionList += `${index + 1}. User ID: ${session.userID}\n`;
                    sessionList += `   เข้าสู่ระบบเมื่อ: ${loginTime}\n`;
                    sessionList += `   หมดอายุ: ${expiresAt}\n`;
                    sessionList += `   Token: ${session.token.substring(0, 8)}...\n\n`;
                });
                
                return api.sendMessage(sessionList, threadID, messageID);
                
            case 'รีเซ็ต':
            case 'reset':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการผู้ใช้ รีเซ็ต 123456789",
                        threadID, messageID
                    );
                }
                
                const resetUserID = args[1];
                
                // ตรวจสอบว่าผู้ใช้มีอยู่
                const userExistsForReset = await authManager.userExists(resetUserID);
                if (!userExistsForReset) {
                    return api.sendMessage(
                        "❌ ไม่พบผู้ใช้ที่ระบุ",
                        threadID, messageID
                    );
                }
                
                const resetResult = await authManager.resetPassword(resetUserID);
                if (resetResult.success) {
                    return api.sendMessage(
                        `✅ รีเซ็ตรหัสผ่านเรียบร้อยแล้ว!\n\n` +
                        `👤 User ID: ${resetUserID}\n` +
                        `🔑 รหัสผ่านใหม่: ${resetResult.newPassword}\n\n` +
                        `⚠️ กรุณาแจ้งรหัสผ่านใหม่ให้กับผู้ใช้`,
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ ไม่สามารถรีเซ็ตรหัสผ่านได้: ${resetResult.error}`,
                        threadID, messageID
                    );
                }
                
            case 'ระงับ':
            case 'suspend':
            case 'ban':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการผู้ใช้ ระงับ 123456789",
                        threadID, messageID
                    );
                }
                
                const suspendUserID = args[1];
                
                const suspendResult = await authManager.toggleUserStatus(suspendUserID, false);
                if (suspendResult.success) {
                    return api.sendMessage(
                        `✅ ระงับการใช้งานผู้ใช้เรียบร้อยแล้ว!\n\n` +
                        `👤 User ID: ${suspendUserID}\n` +
                        `📵 ผู้ใช้จะไม่สามารถเข้าสู่ระบบได้`,
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ ไม่สามารถระงับผู้ใช้ได้: ${suspendResult.error}`,
                        threadID, messageID
                    );
                }
                
            case 'เปิด':
            case 'activate':
            case 'unban':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการผู้ใช้ เปิด 123456789",
                        threadID, messageID
                    );
                }
                
                const activateUserID = args[1];
                
                const activateResult = await authManager.toggleUserStatus(activateUserID, true);
                if (activateResult.success) {
                    return api.sendMessage(
                        `✅ เปิดการใช้งานผู้ใช้เรียบร้อยแล้ว!\n\n` +
                        `👤 User ID: ${activateUserID}\n` +
                        `✅ ผู้ใช้สามารถเข้าสู่ระบบได้แล้ว`,
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ ไม่สามารถเปิดการใช้งานผู้ใช้ได้: ${activateResult.error}`,
                        threadID, messageID
                    );
                }
                
            case 'ลบ':
            case 'delete':
            case 'remove':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุ User ID\nตัวอย่าง: จัดการผู้ใช้ ลบ 123456789",
                        threadID, messageID
                    );
                }
                
                const deleteUserID = args[1];
                
                // ไม่ให้ลบตัวเอง
                if (deleteUserID === senderID) {
                    return api.sendMessage(
                        "❌ ไม่สามารถลบบัญชีตัวเองได้",
                        threadID, messageID
                    );
                }
                
                try {
                    // ลบผู้ใช้และ session (ต้องใช้ Firebase Admin)
                    const { getDatabase, ref, remove } = require('firebase/database');
                    const database = getDatabase();
                    
                    await remove(ref(database, `users/${deleteUserID}`));
                    await remove(ref(database, `sessions/${deleteUserID}`));
                    
                    return api.sendMessage(
                        `✅ ลบผู้ใช้เรียบร้อยแล้ว!\n\n` +
                        `👤 User ID: ${deleteUserID}\n` +
                        `🗑️ ข้อมูลและ session ถูกลบทั้งหมด`,
                        threadID, messageID
                    );
                } catch (error) {
                    return api.sendMessage(
                        `❌ ไม่สามารถลบผู้ใช้ได้: ${error.message}`,
                        threadID, messageID
                    );
                }
                
            case 'ล้าง':
            case 'clean':
            case 'cleanup':
                const cleanResult = await authManager.cleanExpiredSessions();
                if (cleanResult.success) {
                    return api.sendMessage(
                        `✅ ล้าง session ที่หมดอายุเรียบร้อยแล้ว!\n\n` +
                        `🗑️ ลบ session ที่หมดอายุ: ${cleanResult.cleaned} รายการ`,
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ ไม่สามารถล้าง session ได้: ${cleanResult.error}`,
                        threadID, messageID
                    );
                }
                
            default:
                return api.sendMessage(
                    "❌ คำสั่งไม่ถูกต้อง\nใช้: จัดการผู้ใช้ [รายชื่อ/session/รีเซ็ต/ระงับ/เปิด/ลบ/ล้าง]",
                    threadID, messageID
                );
        }
    }
};
