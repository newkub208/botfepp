const fs = require("fs");
const path = require("path");

// Path to store AutoDL state
const autoDLStateFile = path.join(__dirname, "../events/autoDLState.json");
const configPath = path.join(__dirname, '../../config.json');

// Initialize AutoDL state file if it doesn't exist
if (!fs.existsSync(autoDLStateFile)) {
    fs.writeFileSync(autoDLStateFile, JSON.stringify({ enabled: false, threads: {} }));
}

module.exports = {
    name: "ออโต้ดาวน์โหลด",
    description: "เปิด/ปิด ดาวน์โหลดสื่ออัตโนมัติ (TikTok, YouTube, Instagram, Facebook)",
    usage: "[เปิด/ปิด]",
    nashPrefix: false,
    aliases: ["autodl", "autodownload"],
    execute: async (api, event, args) => {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // Check if user is admin
        if (event.senderID !== config.adminUID) {
            return api.sendMessage("⚠️ เฉพาะแอดมินเท่านั้นที่สามารถใช้คำสั่งนี้ได้!", event.threadID, event.messageID);
        }

        const action = args[0];
        
        if (!action || (action !== "เปิด" && action !== "ปิด")) {
            return api.sendMessage("❌ กรุณาระบุ 'เปิด' หรือ 'ปิด'\nตัวอย่าง: ออโต้ดาวน์โหลด เปิด", event.threadID, event.messageID);
        }

        try {
            // Read current state
            let autoDLState = {};
            if (fs.existsSync(autoDLStateFile)) {
                autoDLState = JSON.parse(fs.readFileSync(autoDLStateFile, "utf8"));
            } else {
                autoDLState = { enabled: false, threads: {} };
            }
            
            if (action === "เปิด") {
                autoDLState.enabled = true;
                autoDLState.threads[event.threadID] = true;
                fs.writeFileSync(autoDLStateFile, JSON.stringify(autoDLState, null, 2));
                return api.sendMessage("✅ เปิดระบบดาวน์โหลดสื่ออัตโนมัติแล้ว! เมื่อมีคนส่งลิงก์จาก TikTok, YouTube, Instagram, Facebook มาจะดาวน์โหลดทันที", event.threadID, event.messageID);
            } else if (action === "ปิด") {
                if (!autoDLState.threads) autoDLState.threads = {};
                autoDLState.threads[event.threadID] = false;
                fs.writeFileSync(autoDLStateFile, JSON.stringify(autoDLState, null, 2));
                return api.sendMessage("❌ ปิดระบบดาวน์โหลดสื่ออัตโนมัติแล้ว! จะไม่ดาวน์โหลดอัตโนมัติในกลุ่มนี้อีกต่อไป", event.threadID, event.messageID);
            }
        } catch (error) {
            console.error("Error managing AutoDL state:", error);
            return api.sendMessage("❌ เกิดข้อผิดพลาดในการจัดการระบบ AutoDL: " + error.message, event.threadID, event.messageID);
        }
    }
};
