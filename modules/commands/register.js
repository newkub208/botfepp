const { addUser, getMemberInfo } = require('../../utils/memberUtils');

module.exports = {
    name: "สมัครสมาชิก",
    description: "สมัครสมาชิกเพื่อใช้งานบอท (จำเป็นต้องสมัครก่อนใช้คำสั่งอื่นๆ)",
    nashPrefix: false,
    version: "1.0.0",
    role: "user",
    cooldowns: 10,
    aliases: ["register", "signup", "สมัคร", "ลงทะเบียน"],
    
    async execute(api, event, args) {
        const { threadID, messageID, senderID } = event;
        
        try {
            // ตรวจสอบว่าผู้ใช้สมัครแล้วหรือไม่
            const userData = await getMemberInfo(senderID);
            
            if (userData) {
                const registeredDate = new Date(userData.registeredAt).toLocaleDateString('th-TH');
                
                return api.sendMessage(
                    `✅ คุณเป็นสมาชิกแล้ว!\n\n` +
                    `👤 ชื่อ: ${userData.name}\n` +
                    `📅 สมัครเมื่อ: ${registeredDate}\n` +
                    `🔗 User ID: ${senderID}\n\n` +
                    `🎉 คุณสามารถใช้คำสั่งอื่นๆ ของบอทได้แล้ว`,
                    threadID, messageID
                );
            }
            
            // ดึงข้อมูลผู้ใช้จาก Facebook
            const userInfo = await api.getUserInfo(senderID);
            const userName = userInfo[senderID]?.name || 'Unknown User';
            
            // สร้างข้อมูลสมาชิกใหม่
            const newUserData = {
                name: userName,
                userID: senderID,
                registeredFrom: threadID
            };
            
            // บันทึกข้อมูลลง JSON
            const registerSuccess = addUser(senderID, newUserData);
            
            if (registerSuccess) {
                return api.sendMessage(
                    `🎉 สมัครสมาชิกเรียบร้อยแล้ว!\n\n` +
                    `👤 ชื่อ: ${userName}\n` +
                    `🔗 User ID: ${senderID}\n` +
                    `📅 วันที่สมัคร: ${new Date().toLocaleDateString('th-TH')}\n\n` +
                    `✅ คุณสามารถใช้คำสั่งอื่นๆ ของบอทได้แล้ว!\n` +
                    `🔧 ลองพิมพ์ "ช่วยเหลือ" เพื่อดูคำสั่งทั้งหมด`,
                    threadID, messageID
                );
            } else {
                throw new Error('Failed to register user');
            }
            
        } catch (error) {
            console.error('Registration error:', error);
            
            return api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการสมัครสมาชิก\n\n` +
                `Error: ${error.message}\n` +
                `🔧 กรุณาลองใหม่อีกครั้ง`,
                threadID, messageID
            );
        }
    }
};
