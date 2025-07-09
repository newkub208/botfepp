const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Path to store AI state
const aiStateFile = path.join(__dirname, "../events/aiAutoState.json");
const configPath = path.join(__dirname, '../../config.json');
// Create cache directory for images
const cacheDir = path.join(__dirname, "..", "..", "cache");
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

// Initialize AI state file if it doesn't exist
if (!fs.existsSync(aiStateFile)) {
    fs.writeFileSync(aiStateFile, JSON.stringify({ enabled: false, threads: {} }));
}

module.exports = {
    name: "คุยกับai",
    description: "เปิด/ปิด AI อัตโนมัติ หรือสร้างภาพและคุยกับ AI",
    usage: "[เปิด/ปิด] หรือ [ข้อความ/คำขอสร้างภาพ]",
    nashPrefix: false,
    execute: async (api, event, args) => {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // If no arguments, show usage
        if (!args || args.length === 0) {
            return api.sendMessage("❓ วิธีใช้:\n• `คุยกับai เปิด` - เปิด AI อัตโนมัติ\n• `คุยกับai ปิด` - ปิด AI อัตโนมัติ\n• `คุยกับai [ข้อความ]` - คุยกับ AI หรือขอสร้างภาพ", event.threadID, event.messageID);
        }

        const action = args[0];
        
        // Handle enable/disable for admins only
        if (action === "เปิด" || action === "ปิด") {
            // Check if user is admin
            if (event.senderID !== config.adminUID) {
                return api.sendMessage("⚠️ เฉพาะแอดมินเท่านั้นที่สามารถเปิด/ปิดระบบ AI ได้!", event.threadID, event.messageID);
            }

            try {
                // Read current state
                let aiState = {};
                if (fs.existsSync(aiStateFile)) {
                    aiState = JSON.parse(fs.readFileSync(aiStateFile, "utf8"));
                } else {
                    aiState = { enabled: false, threads: {} };
                }
                
                if (action === "เปิด") {
                    aiState.enabled = true;
                    aiState.threads[event.threadID] = true;
                    fs.writeFileSync(aiStateFile, JSON.stringify(aiState, null, 2));
                    return api.sendMessage("✅ เปิดระบบ AI อัตโนมัติแล้ว! ตอนนี้ AI จะตอบทุกข้อความในกลุ่มนี้", event.threadID, event.messageID);
                } else if (action === "ปิด") {
                    if (!aiState.threads) aiState.threads = {};
                    aiState.threads[event.threadID] = false;
                    fs.writeFileSync(aiStateFile, JSON.stringify(aiState, null, 2));
                    return api.sendMessage("❌ ปิดระบบ AI อัตโนมัติแล้ว! AI จะไม่ตอบข้อความอัตโนมัติในกลุ่มนี้อีกต่อไป", event.threadID, event.messageID);
                }
            } catch (error) {
                console.error("Error managing AI state:", error);
                return api.sendMessage("❌ เกิดข้อผิดพลาดในการจัดการระบบ AI: " + error.message, event.threadID, event.messageID);
            }
        } else {
            // Handle AI conversation - available to all users
            const query = args.join(" ");
            
            try {
                // Send waiting message
                const waitingMsg = await api.sendMessage("🤖 กำลังประมวลผล...", event.threadID);
                
                // Call the new API
                const response = await axios.get('https://haji-mix-api.gleeze.com/api/gpt4o', {
                    params: {
                        ask: query,
                        uid: event.senderID,
                        roleplay: 'รับบทเป็นผู้สร้างโค้ดhtmlทำสวยๆตาที่ผู้ใช้สั่งทั้งหมด เป็นไอคอน',
                        api_key: '024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef'
                    },
                    timeout: 30000
                });

                // Delete waiting message
                api.unsendMessage(waitingMsg.messageID);

                if (response.data && response.data.answer) {
                    let messageText = response.data.answer;
                    
                    // Send text response first
                    await api.sendMessage(messageText, event.threadID, event.messageID);
                    
                    // Check if there are images in the response and send them as attachments
                    if (response.data.images && response.data.images.length > 0) {
                        console.log(`[DEBUG] Found ${response.data.images.length} images to send`);
                        
                        for (let i = 0; i < response.data.images.length; i++) {
                            const img = response.data.images[i];
                            console.log(`[DEBUG] Processing image ${i + 1}: ${img.url}`);
                            
                            try {
                                // Download image and save to file first
                                const imageResponse = await axios.get(img.url, {
                                    responseType: 'arraybuffer',
                                    timeout: 30000,
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                    }
                                });
                                
                                console.log(`[DEBUG] Successfully downloaded image ${i + 1}, saving to file`);
                                
                                // Generate unique filename
                                const timestamp = Date.now();
                                const imageExtension = img.url.includes('.png') ? '.png' : '.jpg';
                                const fileName = `image_${timestamp}_${i}.${imageExtension}`;
                                const filePath = path.join(cacheDir, fileName);
                                
                                // Save image to file
                                fs.writeFileSync(filePath, imageResponse.data);
                                console.log(`[DEBUG] Image saved to: ${filePath}`);
                                
                                // Send image as attachment
                                const imageMessage = {
                                    attachment: fs.createReadStream(filePath)
                                };
                                
                                // Add description if available
                                if (img.description) {
                                    imageMessage.body = `📷 ${img.description}`;
                                }
                                
                                await api.sendMessage(imageMessage, event.threadID);
                                console.log(`[DEBUG] Successfully sent image ${i + 1} as attachment`);
                                
                                // Clean up file after sending
                                setTimeout(() => {
                                    if (fs.existsSync(filePath)) {
                                        fs.unlinkSync(filePath);
                                        console.log(`[DEBUG] Cleaned up file: ${filePath}`);
                                    }
                                }, 5000); // Delete after 5 seconds
                                
                                // Add delay between images to avoid rate limiting
                                if (i < response.data.images.length - 1) {
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                }
                                
                            } catch (imageError) {
                                console.error(`[ERROR] Failed to send image ${i + 1}:`, imageError.message);
                                // Fallback to sending URL if image download fails
                                try {
                                    await api.sendMessage(`📷 รูปภาพ ${i + 1}: ${img.url}${img.description ? `\n(${img.description})` : ''}`, event.threadID);
                                } catch (urlError) {
                                    console.error(`[ERROR] Failed to send URL fallback:`, urlError);
                                }
                            }
                        }
                    }
                    
                    return;
                } else {
                    return api.sendMessage("❌ AI ไม่สามารถตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง", event.threadID, event.messageID);
                }

            } catch (error) {
                console.error("AI Query Error:", error);
                return api.sendMessage("❌ เกิดข้อผิดพลาดในการติดต่อ AI: " + error.message, event.threadID, event.messageID);
            }
        }
    }
};
