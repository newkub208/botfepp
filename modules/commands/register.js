const axios = require('axios');

// Firebase Realtime Database URL
const FIREBASE_URL = 'https://apikf-bbe63-default-rtdb.europe-west1.firebasedatabase.app';

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
            const checkResponse = await axios.get(`${FIREBASE_URL}/users/${senderID}.json`);
            
            if (checkResponse.data) {
                const userData = checkResponse.data;
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
                registeredAt: new Date().toISOString(),
                status: 'active',
                lastActive: new Date().toISOString(),
                registeredFrom: threadID,
                commandsUsed: 0
            };
            
            // บันทึกข้อมูลลง Firebase
            const registerResponse = await axios.put(`${FIREBASE_URL}/users/${senderID}.json`, newUserData);
            
            if (registerResponse.status === 200) {
                // อัปเดตสถิติการสมัคร
                try {
                    const statsResponse = await axios.get(`${FIREBASE_URL}/stats.json`);
                    const currentStats = statsResponse.data || { totalUsers: 0, registrationsToday: 0 };
                    
                    const today = new Date().toDateString();
                    const lastUpdate = currentStats.lastUpdate ? new Date(currentStats.lastUpdate).toDateString() : '';
                    
                    const newStats = {
                        totalUsers: (currentStats.totalUsers || 0) + 1,
                        registrationsToday: today === lastUpdate ? (currentStats.registrationsToday || 0) + 1 : 1,
                        lastUpdate: new Date().toISOString()
                    };
                    
                    await axios.put(`${FIREBASE_URL}/stats.json`, newStats);
                } catch (statsError) {
                    console.error('Error updating stats:', statsError);
                }
                
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
            
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return api.sendMessage(
                    `❌ ไม่สามารถเชื่อมต่อกับระบบสมัครสมาชิกได้\n\n` +
                    `🔧 กรุณาลองใหม่อีกครั้งในภายหลัง\n` +
                    `📞 หากยังมีปัญหา กรุณาติดต่อผู้ดูแลระบบ`,
                    threadID, messageID
                );
            }
            
            return api.sendMessage(
                `❌ เกิดข้อผิดพลาดในการสมัครสมาชิก\n\n` +
                `Error: ${error.message}\n` +
                `🔧 กรุณาลองใหม่อีกครั้ง`,
                threadID, messageID
            );
        }
    }
};
