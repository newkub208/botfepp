const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Path to AI state file
const aiStateFile = path.join(__dirname, "aiAutoState.json");

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

            // Call Gemini Flash 2.0 API
            const response = await axios.get(`https://kaiz-apis.gleeze.com/api/gemini-flash-2.0`, {
                params: {
                    q: query,
                    uid: event.senderID,
                    imageUrl: imageUrl,
                    apikey: 'e62d60dd-8853-4233-bbcb-9466b4cbc265'
                },
                timeout: 30000 // 30 second timeout
            });

            if (response.data && response.data.response) {
                // Send AI response
                return api.sendMessage(response.data.response, event.threadID, event.messageID);
            }

        } catch (error) {
            console.error("AI Auto Reply Error:", error);
            // Don't send error messages to avoid spam
            // Just log the error silently
        }
    }
};
