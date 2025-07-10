const fs = require('fs');
const path = require('path');

module.exports = {
    name: "ล้างประวัติเข้ากลุ่ม",
    description: "ล้างประวัติการเข้ากลุ่มของบอท (ใช้ได้เฉพาะแอดมินสูงสุด)",
    usage: "/ล้างประวัติเข้ากลุ่ม",
    version: "1.0.0",
    nashPrefix: false,
    aliases: ['clearjoinhistory', 'cleargrouphistory'],
    cooldowns: 10,
    
    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;
        
        try {
            // โหลดค่าคอนฟิกเพื่อตรวจสอบแอดมินสูงสุด
            const configPath = path.join(__dirname, '../../config.json');
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            
            // ตรวจสอบว่าเป็นแอดมินสูงสุดหรือไม่
            if (senderID !== config.adminUID) {
                return api.sendMessage('❌ คำสั่งนี้ใช้ได้เฉพาะแอดมินสูงสุดเท่านั้น!', threadID, messageID);
            }
            
            const joinLogPath = path.join(__dirname, '../cache/join_group_log.json');
            
            // ตรวจสอบว่ามีไฟล์ประวัติหรือไม่
            if (!fs.existsSync(joinLogPath)) {
                return api.sendMessage('📝 ไม่มีประวัติการเข้ากลุ่มให้ล้าง', threadID, messageID);
            }
            
            let joinLog = [];
            try {
                joinLog = JSON.parse(fs.readFileSync(joinLogPath, 'utf-8'));
            } catch (error) {
                return api.sendMessage('❌ ไม่สามารถอ่านไฟล์ประวัติได้', threadID, messageID);
            }
            
            if (joinLog.length === 0) {
                return api.sendMessage('📝 ไม่มีประวัติการเข้ากลุ่มให้ล้าง', threadID, messageID);
            }
            
            // สร้างข้อความยืนยัน
            const confirmMessage = `⚠️ คำเตือน!\n\nคุณต้องการล้างประวัติการเข้ากลุ่มทั้งหมด ${joinLog.length} รายการหรือไม่?\n\n• พิมพ์ "ยืนยัน" เพื่อดำเนินการ\n• พิมพ์ "ยกเลิก" เพื่อยกเลิก\n\n⏱️ หมดเวลาใน 30 วินาที`;
            
            const confirmMsg = await api.sendMessage(confirmMessage, threadID, messageID);
            
            // รอรับการตอบกลับ
            const handleReply = (replyEvent) => {
                if (replyEvent.threadID !== threadID || replyEvent.senderID !== senderID) {
                    return;
                }
                
                const userReply = replyEvent.body.trim().toLowerCase();
                
                if (userReply === 'ยืนยัน') {
                    try {
                        // บันทึกข้อมูลสำรองก่อนล้าง
                        const backupPath = path.join(__dirname, '../cache/join_group_log_backup.json');
                        const backupData = {
                            timestamp: new Date().toISOString(),
                            clearedBy: senderID,
                            data: joinLog
                        };
                        
                        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
                        
                        // ล้างประวัติ
                        fs.writeFileSync(joinLogPath, JSON.stringify([], null, 2));
                        
                        const successMessage = `✅ ล้างประวัติการเข้ากลุ่มสำเร็จ!\n\n📊 รายละเอียด:\n• ล้างรายการ: ${joinLog.length} รายการ\n• สำรองข้อมูลแล้ว: join_group_log_backup.json\n• ดำเนินการโดย: ${senderID}\n• เวลา: ${new Date().toLocaleString('th-TH')}`;
                        
                        api.sendMessage(successMessage, threadID);
                        api.unsendMessage(confirmMsg.messageID);
                        
                    } catch (error) {
                        console.error('Error clearing join history:', error);
                        api.sendMessage(`❌ เกิดข้อผิดพลาดในการล้างประวัติ: ${error.message}`, threadID);
                    }
                    
                } else if (userReply === 'ยกเลิก') {
                    api.sendMessage('✅ ยกเลิกการล้างประวัติแล้ว', threadID);
                    api.unsendMessage(confirmMsg.messageID);
                    
                } else {
                    api.sendMessage('❌ กรุณาพิมพ์ "ยืนยัน" หรือ "ยกเลิก" เท่านั้น', threadID);
                    return; // ไม่ยกเลิก listener ให้ผู้ใช้ตอบใหม่
                }
                
                // ยกเลิก listener
                api.removeListener('message', handleReply);
            };
            
            // ตั้งค่า listener
            api.addListener('message', handleReply);
            
            // ตั้งเวลาหมดอายุ 30 วินาที
            setTimeout(() => {
                api.removeListener('message', handleReply);
                api.sendMessage('⏰ หมดเวลาการยืนยัน - ยกเลิกการล้างประวัติแล้ว', threadID);
                api.unsendMessage(confirmMsg.messageID);
            }, 30000);
            
        } catch (error) {
            console.error('Error in ล้างประวัติเข้ากลุ่ม command:', error);
            api.sendMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`, threadID, messageID);
        }
    }
};
