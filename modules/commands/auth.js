const authManager = require('../../utils/authManager');

module.exports = {
    name: "เข้าสู่ระบบ",
    description: "ลงชื่อเข้าใช้งานระบบเพื่อใช้คำสั่งต่างๆ",
    nashPrefix: true,
    version: "1.0.0",
    role: "user", // ทุกคนสามารถใช้ได้
    cooldowns: 5,
    aliases: ["login", "signin", "auth"],
    
    async execute(api, event, args) {
        const { threadID, messageID, senderID } = event;
        
        if (args.length === 0) {
            let message = "🔐 ระบบเข้าสู่ระบบ\n";
            message += "═══════════════════\n\n";
            message += "📋 คำสั่งที่ใช้ได้:\n";
            message += "• เข้าสู่ระบบ สมัคร [ชื่อผู้ใช้] - สมัครสมาชิกใหม่\n";
            message += "• เข้าสู่ระบบ เข้า [รหัสผ่าน] - เข้าสู่ระบบ\n";
            message += "• เข้าสู่ระบบ ออก - ออกจากระบบ\n";
            message += "• เข้าสู่ระบบ เปลี่ยน [รหัสเดิม] [รหัสใหม่] - เปลี่ยนรหัสผ่าน\n";
            message += "• เข้าสู่ระบบ สถานะ - ตรวจสอบสถานะการเข้าสู่ระบบ\n\n";
            message += "⚠️ หมายเหตุ: ต้องลงชื่อเข้าใช้ก่อนจึงจะใช้คำสั่งอื่นๆ ได้!";
            
            return api.sendMessage(message, threadID, messageID);
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'สมัคร':
            case 'register':
            case 'signup':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุชื่อผู้ใช้\nตัวอย่าง: เข้าสู่ระบบ สมัคร ชื่อของฉัน",
                        threadID, messageID
                    );
                }
                
                const username = args.slice(1).join(' ');
                
                // ตรวจสอบว่าผู้ใช้เคยสมัครแล้วหรือไม่
                const userExists = await authManager.userExists(senderID);
                if (userExists) {
                    return api.sendMessage(
                        "❌ คุณเคยสมัครสมาชิกแล้ว\nหากลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ",
                        threadID, messageID
                    );
                }
                
                // สมัครสมาชิก
                const registerResult = await authManager.registerUser(senderID, username);
                if (registerResult.success) {
                    return api.sendMessage(
                        `✅ สมัครสมาชิกเรียบร้อยแล้ว!\n\n` +
                        `👤 ชื่อผู้ใช้: ${username}\n` +
                        `🔑 รหัสผ่าน: ${registerResult.password}\n\n` +
                        `⚠️ กรุณาเก็บรหัสผ่านไว้ให้ดี!\n` +
                        `ใช้คำสั่ง "เข้าสู่ระบบ เข้า ${registerResult.password}" เพื่อเข้าสู่ระบบ`,
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ ไม่สามารถสมัครสมาชิกได้: ${registerResult.error}`,
                        threadID, messageID
                    );
                }
                
            case 'เข้า':
            case 'login':
            case 'signin':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุรหัสผ่าน\nตัวอย่าง: เข้าสู่ระบบ เข้า รหัสผ่านของคุณ",
                        threadID, messageID
                    );
                }
                
                const password = args[1];
                
                // เข้าสู่ระบบ
                const loginResult = await authManager.login(senderID, password);
                if (loginResult.success) {
                    const expiresAt = new Date(loginResult.expiresAt);
                    return api.sendMessage(
                        `✅ เข้าสู่ระบบเรียบร้อยแล้ว!\n\n` +
                        `👤 ชื่อผู้ใช้: ${loginResult.userData.username}\n` +
                        `⏰ Session หมดอายุ: ${expiresAt.toLocaleString('th-TH')}\n\n` +
                        `🎉 ตอนนี้คุณสามารถใช้คำสั่งต่างๆ ได้แล้ว!`,
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ เข้าสู่ระบบไม่สำเร็จ: ${loginResult.error}`,
                        threadID, messageID
                    );
                }
                
            case 'ออก':
            case 'logout':
            case 'signout':
                // ตรวจสอบ session ก่อน
                const sessionCheck = await authManager.validateSession(senderID);
                if (!sessionCheck.valid) {
                    return api.sendMessage(
                        "❌ คุณยังไม่ได้เข้าสู่ระบบ",
                        threadID, messageID
                    );
                }
                
                // ออกจากระบบ
                const logoutResult = await authManager.logout(senderID);
                if (logoutResult.success) {
                    return api.sendMessage(
                        "✅ ออกจากระบบเรียบร้อยแล้ว!\n\nเข้าสู่ระบบใหม่เมื่อต้องการใช้คำสั่งต่างๆ",
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ ไม่สามารถออกจากระบบได้: ${logoutResult.error}`,
                        threadID, messageID
                    );
                }
                
            case 'เปลี่ยน':
            case 'change':
            case 'changepass':
                if (args.length < 3) {
                    return api.sendMessage(
                        "❌ กรุณาระบุรหัสผ่านเดิมและรหัสผ่านใหม่\nตัวอย่าง: เข้าสู่ระบบ เปลี่ยน รหัสเดิม รหัสใหม่",
                        threadID, messageID
                    );
                }
                
                const oldPassword = args[1];
                const newPassword = args[2];
                
                // ตรวจสอบ session ก่อน
                const sessionValid = await authManager.validateSession(senderID);
                if (!sessionValid.valid) {
                    return api.sendMessage(
                        "❌ กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน",
                        threadID, messageID
                    );
                }
                
                // เปลี่ยนรหัสผ่าน
                const changeResult = await authManager.changePassword(senderID, oldPassword, newPassword);
                if (changeResult.success) {
                    return api.sendMessage(
                        `✅ เปลี่ยนรหัสผ่านเรียบร้อยแล้ว!\n\n` +
                        `🔑 รหัสผ่านใหม่: ${newPassword}\n` +
                        `⚠️ กรุณาเก็บรหัสผ่านใหม่ไว้ให้ดี!`,
                        threadID, messageID
                    );
                } else {
                    return api.sendMessage(
                        `❌ ไม่สามารถเปลี่ยนรหัสผ่านได้: ${changeResult.error}`,
                        threadID, messageID
                    );
                }
                
            case 'สถานะ':
            case 'status':
            case 'info':
                // ตรวจสอบ session
                const currentSession = await authManager.validateSession(senderID);
                
                if (!currentSession.valid) {
                    return api.sendMessage(
                        "🔴 สถานะ: ยังไม่ได้เข้าสู่ระบบ\n\n" +
                        "กรุณาใช้คำสั่ง 'เข้าสู่ระบบ เข้า [รหัสผ่าน]' เพื่อเข้าสู่ระบบ",
                        threadID, messageID
                    );
                }
                
                const sessionData = currentSession.sessionData;
                const loginTime = new Date(sessionData.loginTime);
                const expiresAt = new Date(sessionData.expiresAt);
                const timeLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60)); // ชั่วโมงที่เหลือ
                
                return api.sendMessage(
                    `🟢 สถานะ: เข้าสู่ระบบแล้ว\n\n` +
                    `👤 ผู้ใช้: ${senderID}\n` +
                    `⏰ เข้าสู่ระบบเมื่อ: ${loginTime.toLocaleString('th-TH')}\n` +
                    `⏳ Session หมดอายุใน: ${timeLeft} ชั่วโมง\n\n` +
                    `✅ สามารถใช้คำสั่งต่างๆ ได้`,
                    threadID, messageID
                );
                
            default:
                return api.sendMessage(
                    "❌ คำสั่งไม่ถูกต้อง\nใช้: เข้าสู่ระบบ [สมัคร/เข้า/ออก/เปลี่ยน/สถานะ]",
                    threadID, messageID
                );
        }
    }
};
