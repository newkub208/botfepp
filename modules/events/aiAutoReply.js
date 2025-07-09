const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Path to AI state file
const aiStateFile = path.join(__dirname, "aiAutoState.json");
// Create cache directory for images
const cacheDir = path.join(__dirname, "..", "..", "cache");
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}

module.exports = {
    name: "aiAutoReply",
    version: "1.0.0",
    description: "Auto reply with AI when enabled",
    author: "Kaizenji",
    async onEvent({ api, event }) {
        // Skip if it's a command (starts with /)
        if (event.body && event.body.startsWith("/")) return;
        
        // Skip if it's from bot itself
        if (event.senderID === api.getCurrentUserID()) return;
        
        // Skip if no message body and no attachments
        if (!event.body && !event.attachments?.length) return;

        try {
            // Check if AI auto reply is enabled for this thread
            if (!fs.existsSync(aiStateFile)) return;
            
            const aiState = JSON.parse(fs.readFileSync(aiStateFile, "utf8"));
            
            // Check if AI is enabled globally and for this specific thread
            if (!aiState.enabled || !aiState.threads[event.threadID]) return;

            let query = event.body || "สวัสดี";
            let imageUrl = "";

            // Check if there's an image attachment
            if (event.attachments && event.attachments.length > 0) {
                const attachment = event.attachments[0];
                if (attachment.type === "photo") {
                    imageUrl = attachment.url;
                    if (!event.body) {
                        query = "อธิบายภาพนี้หน่อย";
                    }
                }
            }

            // Call GPT-4O API
            const response = await axios.get(`https://haji-mix-api.gleeze.com/api/gpt4o`, {
                params: {
                    ask: query,
                    uid: event.senderID,
                    roleplay: 'รับบทเป็นผู้สร้างโค้ดhtmlทำสวยๆตาที่ผู้ใช้สั่งทั้งหมด เป็นไอคอน',
                    api_key: '024875ee661a808c753b5e2f6a3eb908547691275d2015a884772153679618ef'
                },
                timeout: 30000 // 30 second timeout
            });

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
            }

        } catch (error) {
            console.error("AI Auto Reply Error:", error);
            // Don't send error messages to avoid spam
            // Just log the error silently
        }
    }
};
