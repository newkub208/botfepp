/**
 * @name testAutoReply
 * @description ทดสอบระบบ Auto Reply Tag
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

module.exports = {
    name: "testAutoReply",
    description: "ทดสอบระบบ Auto Reply Tag",
    version: "1.0.0",
    aliases: ["testTag"],
    nashPrefix: false,
    cooldowns: 5,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;
        
        // ตรวจสอบสิทธิ์แอดมิน
        const adminUID = global.config?.adminUID || "61555184860915";
        if (senderID !== adminUID) {
            return api.sendMessage("❌ คำสั่งทดสอบใช้ได้เฉพาะแอดมินเท่านั้น", threadID, messageID);
        }

        try {
            // โหลดการตั้งค่า
            const configPath = path.join(__dirname, 'autoReplyTagConfig.json');
            let config = {};
            
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } else {
                config = {
                    enabled: true,
                    targetUID: "61555184860915",
                    replyMessage: "ไม่ว่าง",
                    threads: {}
                };
            }

            // ตรวจสอบ event handler
            const eventHandlerPath = path.join(__dirname, '../events/autoReplyTag.js');
            const eventHandlerExists = fs.existsSync(eventHandlerPath);

            // สร้างข้อความทดสอบ
            let testMessage = `🧪 ผลการทดสอบระบบ Auto Reply Tag\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                            `📁 Config File: ${fs.existsSync(configPath) ? '✅ พบ' : '❌ ไม่พบ'}\n` +
                            `📁 Event Handler: ${eventHandlerExists ? '✅ พบ' : '❌ ไม่พบ'}\n` +
                            `📊 ระบบเปิดใช้งาน: ${config.enabled ? '✅ เปิด' : '❌ ปิด'}\n` +
                            `🎯 UID เป้าหมาย: ${config.targetUID}\n` +
                            `💬 ข้อความตอบกลับ: "${config.replyMessage}"\n\n`;

            // ตรวจสอบการโหลด event handler
            try {
                delete require.cache[require.resolve(eventHandlerPath)];
                const eventModule = require(eventHandlerPath);
                testMessage += `🔧 Event Module: ✅ โหลดได้\n`;
                testMessage += `🔧 Function onEvent: ${typeof eventModule.onEvent === 'function' ? '✅ พบ' : '❌ ไม่พบ'}\n`;
            } catch (error) {
                testMessage += `🔧 Event Module: ❌ โหลดไม่ได้ (${error.message})\n`;
            }

            testMessage += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            testMessage += `💡 วิธีทดสอบ: ให้คนอื่นแท็ก @${config.targetUID}\n`;
            testMessage += `🔄 หากไม่ทำงาน: รีสตาร์ทบอทเพื่อโหลด event handler ใหม่`;

            api.sendMessage(testMessage, threadID, messageID);

        } catch (error) {
            console.error('[TestAutoReply Error]:', error);
            api.sendMessage(`❌ เกิดข้อผิดพลาดในการทดสอบ: ${error.message}`, threadID, messageID);
        }
    }
};
