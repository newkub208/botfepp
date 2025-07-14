/**
 * @name สร้างคำสั่ง
 * @description สร้าง, ดูรายการ, หรือลบคำสั่งบอทโดยใช้ AI (ใช้ Gemini Vision API) คำสั่งจะมีอายุ 1 วัน - ปรับปรุงความเสถียร
 * @version 2.4.2
 * @author (Your Name) - Updated to use Gemini Vision endpoint + Enhanced error handling
 * @nashPrefix false
 * @cooldowns 60
 * @aliases ["createcmd", "newcmd", "cmd", "คำสั่ง"]
 */

// --- Dependencies ---
const axios = require('axios');
const fs = require("fs");
const path = require("path");

// --- Configuration ---
const CONFIG = {
    // [UPDATED] เปลี่ยนเป็น gemini-vision endpoint 
    KAIZ_API_URL: "https://kaiz-apis.gleeze.com/api/gemini-vision",
    KAIZ_API_KEY: "e62d60dd-8853-4233-bbcb-9466b4cbc265",
    COMMAND_EXPIRY_HOURS: 24,
};

// --- Directories and State for Generated Commands ---
const GENERATED_CMD_DIR = path.join(__dirname, "generated_commands");
const STATE_FILE = path.join(GENERATED_CMD_DIR, "_state.json");
const USER_HISTORY_FILE = path.join(GENERATED_CMD_DIR, "_user_history.json");

fs.mkdirSync(GENERATED_CMD_DIR, { recursive: true });

let commandState = {};
let userHistory = {};

try {
    if (fs.existsSync(STATE_FILE)) {
        commandState = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
} catch (error) {
    console.error("Failed to load generated commands state file:", error);
    commandState = {};
}

try {
    if (fs.existsSync(USER_HISTORY_FILE)) {
        userHistory = JSON.parse(fs.readFileSync(USER_HISTORY_FILE, "utf8"));
    }
} catch (error) {
    console.error("Failed to load user history file:", error);
    userHistory = {};
}

// --- Helper Functions ---
function formatRemainingTime(ms) {
    if (ms <= 0) return "หมดอายุแล้ว";
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    minutes %= 60;
    let result = [];
    if (hours > 0) result.push(`${hours}ชม`);
    if (minutes > 0) result.push(`${minutes}นาที`);
    return result.length > 0 ? result.join(' ') : "น้อยกว่า 1 นาที";
}

function saveUserHistory() {
    try {
        fs.writeFileSync(USER_HISTORY_FILE, JSON.stringify(userHistory, null, 2));
    } catch (error) {
        console.error("Failed to save user history:", error);
    }
}

function addToUserHistory(userId, prompt, commandName) {
    if (!userHistory[userId]) {
        userHistory[userId] = {
            requests: [],
            totalCommands: 0,
            lastUsed: Date.now()
        };
    }
    
    userHistory[userId].requests.unshift({
        prompt: prompt,
        commandName: commandName,
        timestamp: Date.now()
    });
    
    // เก็บไว้แค่ 10 คำขอล่าสุด
    if (userHistory[userId].requests.length > 10) {
        userHistory[userId].requests = userHistory[userId].requests.slice(0, 10);
    }
    
    userHistory[userId].totalCommands++;
    userHistory[userId].lastUsed = Date.now();
    saveUserHistory();
}

function getUserHistory(userId) {
    return userHistory[userId] || null;
}

function generateSmartPrompt(userPrompt, userId) {
    const history = getUserHistory(userId);
    let enhancedPrompt = userPrompt;
    
    if (history && history.requests.length > 0) {
        const recentRequests = history.requests.slice(0, 3).map(r => r.prompt).join(', ');
        enhancedPrompt = `Based on user's request: "${userPrompt}". User's recent requests context: ${recentRequests}. Create a JavaScript bot command that fits the request.`;
    } else {
        enhancedPrompt = `Create a JavaScript bot command for: "${userPrompt}"`;
    }
    
    return enhancedPrompt;
}

// --- Expiry Management ---
const timeouts = {};

function deleteGeneratedCommand(commandName) {
    const rec = commandState[commandName];
    if (!rec || !rec.filename) {
        if (commandState[commandName]) {
            delete commandState[commandName];
            fs.writeFileSync(STATE_FILE, JSON.stringify(commandState, null, 2));
        }
        return;
    }
    const filePath = path.join(GENERATED_CMD_DIR, rec.filename);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`🗑️ Deleted expired command file: ${rec.filename}`);
        }
        delete commandState[commandName];
        fs.writeFileSync(STATE_FILE, JSON.stringify(commandState, null, 2));
        clearTimeout(timeouts[commandName]);
        console.log(`ℹ️ Command "${commandName}" has been deleted. Bot may require a restart or command reload to reflect the change.`);
    } catch (err) {
        console.error(`Failed to delete command file ${rec.filename}:`, err);
    }
}

function scheduleCommandExpiry(commandName, rec) {
    if (!rec || !rec.expiresAt) return;
    const msLeft = rec.expiresAt - Date.now();
    if (msLeft <= 0) {
        return deleteGeneratedCommand(commandName);
    }
    timeouts[commandName] = setTimeout(() => deleteGeneratedCommand(commandName), msLeft);
}

Object.entries(commandState).forEach(([cmdName, rec]) => scheduleCommandExpiry(cmdName, rec));

// --- Functions for Listing and Deleting ---

async function listGeneratedCommands(api, event, prefix) {
    const { threadID, messageID, senderID } = event;
    const commandEntries = Object.entries(commandState);
    const userCommands = commandEntries.filter(([, data]) => data.creatorId === senderID);
    const userHistoryData = getUserHistory(senderID);

    if (commandEntries.length === 0) {
        return api.sendMessage("🤖 ยังไม่มีคำสั่งที่ผู้ใช้สร้างขึ้นในขณะนี้", threadID, messageID);
    }

    let response = "📋 รายการคำสั่งที่ผู้ใช้สร้าง\n" +
                  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

    // แสดงสถิติผู้ใช้
    if (userHistoryData) {
        response += `👤 สถิติของคุณ:\n`;
        response += `   • สร้างคำสั่งทั้งหมด: ${userHistoryData.totalCommands} คำสั่ง\n`;
        response += `   • คำสั่งที่ยังใช้งานได้: ${userCommands.length} คำสั่ง\n\n`;
    }

    // แสดงคำสั่งที่ยังใช้งานได้
    if (userCommands.length > 0) {
        response += "🟢 คำสั่งที่คุณสร้างและยังใช้งานได้:\n";
        response += "─────────────────────────────────────────\n";
        
        userCommands.forEach(([commandName, data], index) => {
            const remainingMs = data.expiresAt - Date.now();
            const remainingTime = formatRemainingTime(remainingMs);
            const expiryDate = new Date(data.expiresAt).toLocaleString("th-TH", {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false
            });

            response += `${index + 1}. 💡 ${data.prompt}\n`;
            response += `   └ 🔧 คำสั่ง: ${prefix}${commandName}\n`;
            response += `   └ ⏰ หมดอายุ: ${expiryDate} (เหลือ ${remainingTime})\n\n`;
        });
    }

    // แสดงคำสั่งของผู้อื่น (ถ้ามี)
    const otherCommands = commandEntries.filter(([, data]) => data.creatorId !== senderID);
    if (otherCommands.length > 0) {
        response += "🔵 คำสั่งของผู้ใช้อื่น:\n";
        response += "─────────────────────────────────────────\n";
        
        otherCommands.slice(0, 3).forEach(([commandName, data], index) => {
            const remainingMs = data.expiresAt - Date.now();
            const remainingTime = formatRemainingTime(remainingMs);
            
            response += `${index + 1}. ${data.prompt.substring(0, 30)}${data.prompt.length > 30 ? '...' : ''}\n`;
            response += `   └ 🔧 คำสั่ง: ${prefix}${commandName} (เหลือ ${remainingTime})\n\n`;
        });
        
        if (otherCommands.length > 3) {
            response += `   และอีก ${otherCommands.length - 3} คำสั่ง...\n\n`;
        }
    }
    
    response += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    response += `🎯 วิธีใช้: พิมพ์ ${prefix}<ชื่อคำสั่ง> เพื่อเรียกใช้\n`;
    response += `🗑️ ลบคำสั่ง: ${prefix}สร้างคำสั่ง ลบ <ชื่อคำสั่ง>\n`;
    response += `📊 ประวัติ: ${prefix}สร้างคำสั่ง ประวัติ`;

    api.sendMessage(response, threadID, messageID);
}

async function handleDeleteCommand(api, event, commandNameToDelete) {
    const { threadID, messageID } = event;

    if (!commandNameToDelete) {
        return api.sendMessage(`โปรดระบุชื่อคำสั่งที่ต้องการลบ\nตัวอย่าง: ${event.prefix}สร้างคำสั่ง ลบ mycommand`, threadID, messageID);
    }

    const commandData = commandState[commandNameToDelete];
    if (!commandData) {
        return api.sendMessage(`ไม่พบคำสั่งชื่อ "${commandNameToDelete}"`, threadID, messageID);
    }

    try {
        deleteGeneratedCommand(commandNameToDelete);
        api.sendMessage(`✅ ลบคำสั่ง "${commandNameToDelete}" สำเร็จแล้ว`, threadID, messageID);
    } catch (error) {
        console.error(`Error deleting command ${commandNameToDelete}:`, error);
        api.sendMessage(`เกิดข้อผิดพลาดในการลบคำสั่ง: ${error.message}`, threadID, messageID);
    }
}

async function showUserHistory(api, event, prefix) {
    const { threadID, messageID, senderID } = event;
    const userHistoryData = getUserHistory(senderID);

    if (!userHistoryData || userHistoryData.requests.length === 0) {
        return api.sendMessage("🤖 คุณยังไม่เคยสร้างคำสั่งใดๆ มาก่อน", threadID, messageID);
    }

    let response = "📊 ประวัติการสร้างคำสั่งของคุณ\n" +
                  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

    response += `👤 สถิติรวม:\n`;
    response += `   • สร้างคำสั่งทั้งหมด: ${userHistoryData.totalCommands} คำสั่ง\n`;
    response += `   • ใช้งานครั้งล่าสุด: ${new Date(userHistoryData.lastUsed).toLocaleString("th-TH")}\n\n`;

    response += "📝 คำขอล่าสุด:\n";
    response += "─────────────────────────────────────────\n";

    userHistoryData.requests.forEach((request, index) => {
        const timeAgo = formatRemainingTime(Date.now() - request.timestamp);
        const isActive = commandState[request.commandName] ? "🟢 ใช้งานได้" : "🔴 หมดอายุ";
        
        response += `${index + 1}. ${request.prompt}\n`;
        response += `   └ 🔧 คำสั่ง: ${prefix}${request.commandName}\n`;
        response += `   └ ⏰ สร้างเมื่อ: ${timeAgo}ที่แล้ว\n`;
        response += `   └ 📊 สถานะ: ${isActive}\n\n`;
    });

    response += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    response += `💡 เคล็ดลับ: AI จะจดจำการใช้งานของคุณเพื่อสร้างคำสั่งที่เหมาะสมมากขึ้น`;

    api.sendMessage(response, threadID, messageID);
}

// --- Main Command ---
module.exports = {
    name: "สร้างคำสั่ง",
    description: "สร้าง, ดูรายการ, หรือลบคำสั่งบอทโดยใช้ AI พร้อมระบบจดจำผู้ใช้ คำสั่งจะมีอายุ 1 วัน - ปรับปรุงความเสถียร",
    version: "2.4.2",
    aliases: ["createcmd", "newcmd", "cmd", "คำสั่ง"],
    nashPrefix: false,
    cooldowns: 60,

    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;
        const subCommand = args[0]?.toLowerCase();

        if (subCommand === 'รายการ' || subCommand === 'list') {
            return listGeneratedCommands(api, event, prefix);
        }

        if (subCommand === 'ประวัติ' || subCommand === 'history') {
            return showUserHistory(api, event, prefix);
        }

        if (subCommand === 'ลบ' || subCommand === 'delete') {
            const commandNameToDelete = args[1];
            return handleDeleteCommand(api, event, commandNameToDelete);
        }

        const userPrompt = args.join(" ").trim();

        if (!userPrompt) {
            const userHistoryData = getUserHistory(senderID);
            const hasHistory = userHistoryData && userHistoryData.requests.length > 0;
            
            let usageMessage = `🤖 ระบบสร้างคำสั่งอัจฉริยะ\n` +
                             `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

            if (hasHistory) {
                usageMessage += `👋 ยินดีต้อนรับกลับ! คุณเคยสร้างคำสั่งแล้ว ${userHistoryData.totalCommands} คำสั่ง\n\n`;
                
                // แสดงคำแนะนำจากประวัติ
                const recentPrompt = userHistoryData.requests[0].prompt;
                usageMessage += `💡 ตัวอย่างล่าสุดของคุณ:\n"${recentPrompt}"\n\n`;
            } else {
                usageMessage += `🎉 ยินดีต้อนรับสู่ระบบสร้างคำสั่งครั้งแรก!\n\n`;
            }

            usageMessage += `📋 วิธีใช้งาน:\n\n` +
                          `1️⃣ สร้างคำสั่งใหม่:\n   ${prefix}สร้างคำสั่ง <ไอเดียของคุณ>\n` +
                          `   📝 ตัวอย่าง: ${prefix}สร้างคำสั่ง สุ่มตัวเลข 1-100\n\n` +
                          `2️⃣ ดูรายการคำสั่งทั้งหมด:\n   ${prefix}สร้างคำสั่ง รายการ\n\n` +
                          `3️⃣ ดูประวัติการใช้งาน:\n   ${prefix}สร้างคำสั่ง ประวัติ\n\n` +
                          `4️⃣ ลบคำสั่ง:\n   ${prefix}สร้างคำสั่ง ลบ <ชื่อคำสั่ง>\n\n`;

            if (hasHistory) {
                usageMessage += `🧠 AI จะใช้ประวัติของคุณเพื่อสร้างคำสั่งที่เหมาะสมขึ้น!`;
            } else {
                usageMessage += `💭 เคล็ดลับ: ใช้ภาษาง่ายๆ เช่น "สร้างคำสั่งแสดงข้อความสวัสดี"`;
            }

            return api.sendMessage(usageMessage, threadID, messageID);
        }

        let waitingMessage = null;
        try {
            waitingMessage = await api.sendMessage("🤖 กำลังส่งไอเดียของคุณไปยัง AI...", threadID, messageID);
            await api.editMessage("🚀 AI กำลังสร้างโค้ดคำสั่งสำหรับคุณ (Gemini Vision)...", waitingMessage.messageID);

            const fullApiPrompt = `
                ${generateSmartPrompt(userPrompt, senderID)}
                
                Format required - Create a Facebook Messenger bot command:
                module.exports = {
                    name: "commandname",
                    description: "คำอธิบายภาษาไทย",
                    version: "1.0.0",
                    aliases: ["alias1"],
                    nashPrefix: false,
                    cooldowns: 10,
                    async execute(api, event, args, prefix) {
                        const { threadID, messageID, senderID, mentions = [], body = "" } = event;
                        
                        // Ensure mentions is always an array
                        const mentionList = Array.isArray(mentions) ? mentions : [];
                        const mentionIds = Object.keys(mentionList);
                        
                        // Safe way to get message text
                        const messageText = body || "";
                        
                        // Your command logic here
                        api.sendMessage("ข้อความตอบกลับ", threadID, messageID);
                    }
                };
                
                IMPORTANT RULES:
                1. Always destructure event with default values
                2. Always check if mentions is array before using array methods
                3. Use mentionIds = Object.keys(mentions || {}) for mention IDs
                4. Always handle undefined/null values safely
                5. Use try-catch for any risky operations
                6. Return ONLY the JavaScript code, no explanations.
            `;
            
            // [MODIFIED] Using the Gemini Vision API endpoint
            const apiUrl = `${CONFIG.KAIZ_API_URL}?q=${encodeURIComponent(fullApiPrompt)}&uid=${senderID}&imageUrl=&apikey=${CONFIG.KAIZ_API_KEY}`;
            
            const response = await axios.get(apiUrl, { timeout: 60000 });
            const responseData = response.data;

            if (!responseData || !responseData.response) {
                console.error("[Gemini Vision Response Error] Unexpected format received:", JSON.stringify(responseData, null, 2));
                throw new Error(`API (Gemini Vision) ไม่ได้ให้คำตอบกลับมาในรูปแบบที่ถูกต้อง`);
            }

            let generatedCode = responseData.response;
            
            // ตรวจสอบว่าผลลัพธ์เป็น URL ที่ไม่ใช่โค้ด
            const isOnlyUrl = (generatedCode.includes("googleusercontent.com") && !generatedCode.includes("module.exports")) ||
                             (generatedCode.trim().startsWith("http") && !generatedCode.includes("module.exports"));
            
            if (isOnlyUrl) {
                console.error("[Gemini Vision Invalid Response] Got URL instead of code:", generatedCode);
                throw new Error("API ส่ง URL กลับมาแทนที่จะเป็นโค้ด อาจเป็นเพราะคำขอซับซ้อนเกินไป");
            }
            
            // ตรวจสอบว่ามีข้อความที่ไม่เกี่ยวข้องหรือไม่
            if (generatedCode.length < 50 || !generatedCode.includes("execute")) {
                console.error("[Gemini Vision Short Response]", generatedCode);
                throw new Error("API ตอบกลับข้อความสั้นเกินไป อาจไม่เข้าใจคำขอ");
            }
            
            if (!generatedCode.includes("module.exports")) {
                 console.error("[Gemini Vision Invalid Code]", generatedCode);
                 throw new Error("AI ไม่ได้สร้างโค้ดในรูปแบบที่ถูกต้อง (อาจเป็นข้อความทักทาย)");
            }

            const codeMatch = generatedCode.match(/```(?:javascript|js)?\s*([\s\S]+?)```/);
            if (codeMatch) {
                generatedCode = codeMatch[1].trim();
                console.log("✅ Extracted code from markdown block");
            } else {
                generatedCode = generatedCode.trim();
                console.log("✅ Using code as-is (no markdown block detected)");
            }

            // Validate และทำความสะอาดโค้ด
            if (!generatedCode.includes("module.exports")) {
                console.error("[Code Validation Failed] No module.exports found in:", generatedCode.substring(0, 200));
                throw new Error("โค้ดที่ AI สร้างไม่มี module.exports");
            }

            // แก้ไขปัญหา mentions.includes และ mentions อื่นๆ ที่เป็นไปได้
            generatedCode = generatedCode.replace(
                /mentions\.includes\(/g, 
                '(Array.isArray(mentions) ? mentions : []).includes('
            );
            
            generatedCode = generatedCode.replace(
                /mentions\.length/g, 
                '(Array.isArray(mentions) ? mentions.length : 0)'
            );
            
            generatedCode = generatedCode.replace(
                /mentions\.map\(/g, 
                '(Array.isArray(mentions) ? mentions : []).map('
            );
            
            generatedCode = generatedCode.replace(
                /mentions\.filter\(/g, 
                '(Array.isArray(mentions) ? mentions : []).filter('
            );
            
            generatedCode = generatedCode.replace(
                /mentions\.forEach\(/g, 
                '(Array.isArray(mentions) ? mentions : []).forEach('
            );

            // แก้ไขการใช้ Object.keys(mentions) ให้ปลอดภัย
            generatedCode = generatedCode.replace(
                /Object\.keys\(mentions\)/g, 
                'Object.keys(mentions || {})'
            );

            // เพิ่มการตรวจสอบ event properties ที่สำคัญ
            if (!generatedCode.includes('const { threadID, messageID') && generatedCode.includes('threadID')) {
                generatedCode = generatedCode.replace(
                    /async execute\(api, event, args, prefix\) \{/,
                    `async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, mentions = [], body = "" } = event;`
                );
            }

            // เพิ่ม error handling wrapper ให้กับฟังก์ชัน execute
            if (!generatedCode.includes('try {') && !generatedCode.includes('catch')) {
                generatedCode = generatedCode.replace(
                    /(async execute\(api, event, args, prefix\) \{[\s\S]*?)(api\.sendMessage[\s\S]*?)\s*\}/,
                    `$1try {
            $2
        } catch (error) {
            console.error('[Generated Command Error]:', error);
            api.sendMessage(\`❌ เกิดข้อผิดพลาด: \${error.message}\`, threadID, messageID);
        }
    }`
                );
            }

            const nameMatch = generatedCode.match(/name:\s*["']([^"']+)["']/);
            if (!nameMatch || !nameMatch[1]) {
                throw new Error("ไม่สามารถหาชื่อคำสั่ง (name) จากโค้ดที่ AI สร้างได้");
            }
            const commandName = nameMatch[1];
            const filename = `${commandName}.js`;
            const filePath = path.join(GENERATED_CMD_DIR, filename);

            if (commandState[commandName]) {
                deleteGeneratedCommand(commandName);
            }

            fs.writeFileSync(filePath, generatedCode);

            const expiresAt = Date.now() + CONFIG.COMMAND_EXPIRY_HOURS * 60 * 60 * 1000;
            commandState[commandName] = { filename, expiresAt, prompt: userPrompt, creatorId: senderID };
            fs.writeFileSync(STATE_FILE, JSON.stringify(commandState, null, 2));
            scheduleCommandExpiry(commandName, commandState[commandName]);

            // บันทึกประวัติผู้ใช้
            addToUserHistory(senderID, userPrompt, commandName);

            // รีโหลดคำสั่งใหม่ทันที
            console.log("🔄 Attempting to reload generated commands...");
            if (typeof global.reloadGeneratedCommands === 'function') {
                const reloadedCount = global.reloadGeneratedCommands();
                console.log(`✅ Reloaded ${reloadedCount} commands successfully`);
            } else {
                console.log("⚠️ global.reloadGeneratedCommands function not available");
            }

            const successMessage = `✅ สร้างคำสั่งใหม่สำเร็จแล้ว! (v2.4.2 - ใช้ Gemini Vision)\n\n` +
                                 `🎯 ชื่อคำสั่ง: ${commandName}\n` +
                                 `🚀 คุณสามารถเริ่มใช้งานได้ทันทีด้วย: ${prefix}${commandName}\n` +
                                 `⏰ คำสั่งนี้จะถูกลบใน ${CONFIG.COMMAND_EXPIRY_HOURS} ชั่วโมง\n` +
                                 `🛡️ โค้ดถูกปรับปรุงให้มีความเสถียรและจัดการข้อผิดพลาดอัตโนมัติ\n\n` +
                                 `🧠 AI จะจดจำคำขอนี้เพื่อช่วยสร้างคำสั่งถัดไปที่เหมาะสมขึ้น!\n\n` +
                                 `💡 ดูรายการคำสั่งทั้งหมดด้วย: ${prefix}สร้างคำสั่ง รายการ`;
            await api.sendMessage(successMessage, threadID, messageID);

        } catch (e) {
            console.error(e);
            let errorMessage = `❌ เกิดข้อผิดพลาดในการสร้างคำสั่ง\nสาเหตุ: ${e.message}`;
            
            // ให้คำแนะนำเฉพาะสำหรับปัญหาแต่ละประเภท
            if (e.message.includes("URL กลับมาแทนที่จะเป็นโค้ด")) {
                errorMessage += `\n\n💡 คำแนะนำ: ลองทำให้คำของ่ายขึ้น เช่น:\n`;
                errorMessage += `• "สร้างคำสั่งแสดงข้อความ สวัสดี"\n`;
                errorMessage += `• "สร้างคำสั่งสุ่มตัวเลข 1-100"\n`;
                errorMessage += `• "สร้างคำสั่งบอกเวลาปัจจุบัน"`;
            } else if (e.message.includes("API ไม่ได้ให้คำตอบกลับมา")) {
                errorMessage += `\n\n💡 คำแนะนำ: API อาจมีปัญหา ลองใหม่อีกครั้งใน 1-2 นาที`;
            } else {
                errorMessage += `\n\n💡 คำแนะนำ: ลองใช้คำขอที่ง่ายและชัดเจน เช่น "สร้างคำสั่งพูดสวัสดี"`;
            }
            
            await api.sendMessage(errorMessage, threadID, messageID);
        } finally {
            if (waitingMessage && waitingMessage.messageID) {
                api.unsendMessage(waitingMessage.messageID);
            }
        }
    }
};
