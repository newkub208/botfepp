const fs = require("fs");
const path = require("path");

// Path to store AI state
const aiStateFile = path.join(__dirname, "../events/aiAutoState.json");
const configPath = path.join(__dirname, '../../config.json');

// Initialize AI state file if it doesn't exist
if (!fs.existsSync(aiStateFile)) {
    fs.writeFileSync(aiStateFile, JSON.stringify({ enabled: false, threads: {} }));
}

module.exports = {
    name: "คุยกับai",
    description: "เปิด/ปิด AI อัตโนมัติ",
    usage: "[เปิด/ปิด]",
    nashPrefix: false,
    execute: async (api, event, args) => {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Check if user is admin
        if (event.senderID !== config.adminUID) {
            return api.sendMessage("⚠️ เฉพาะแอดมินเท่านั้นที่สามารถใช้คำสั่งนี้ได้!", event.threadID, event.messageID);
        }

    const action = args[0];
    
    if (!action || (action !== "เปิด" && action !== "ปิด")) {
        return api.sendMessage("❌ กรุณาระบุ 'เปิด' หรือ 'ปิด'\nตัวอย่าง: คุยกับai เปิด", event.threadID, event.messageID);
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
    }
};
