module.exports = {
    name: "showImage",
    description: "โชว์ภาพตามลิงก์ที่ให้มา",
    version: "1.0.0",
    aliases: ["showpic"],
    nashPrefix: false,
    cooldowns: 10,
    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, mentions = [], body = "" } = event;

        // ensure mentions is always an array
        const mentionList = Array.isArray(mentions) ? mentions : [];
        const mentionIds = Object.keys(mentionList);

        // safe way to get message text
        const messageText = body || "";

        try {
            if (args.length > 0 || messageText.includes("โชว์ภาพนี้")) {
                // Send image using stream from URL
                const axios = require('axios');
                const fs = require('fs');
                
                try {
                    const response = await axios({
                        method: 'GET',
                        url: 'https://iili.io/fvo3geb.jpg',
                        responseType: 'stream'
                    });
                    
                    await api.sendMessage({
                        body: "🖼️ นี่คือภาพที่คุณขอ",
                        attachment: response.data
                    }, threadID, messageID);
                } catch (downloadError) {
                    console.error("Error downloading image:", downloadError);
                    await api.sendMessage("❌ ไม่สามารถดาวน์โหลดภาพได้", threadID, messageID);
                }
            } else {
                await api.sendMessage("🖼️ พิมพ์คำสั่งพร้อมข้อความใดๆ เพื่อแสดงภาพ\nตัวอย่าง: /showImage โชว์ภาพนี้", threadID, messageID);
            }
        } catch (error) {
            console.error("Error in showImage command:", error);
            try {
                await api.sendMessage(`❌ เกิดข้อผิดพลาด: ${error.message}`, threadID, messageID);
            } catch (sendError) {
                console.error("Error sending error message:", sendError);
            }
        }
    }
};