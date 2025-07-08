const fs = require('fs');
const path = require('path');

const LINK_PROTECTION_CONFIG_FILE = path.join(__dirname, '../events/linkProtectionState.json');

// ฟังก์ชันโหลดการตั้งค่า
function loadLinkProtectionConfig() {
    try {
        if (fs.existsSync(LINK_PROTECTION_CONFIG_FILE)) {
            const data = fs.readFileSync(LINK_PROTECTION_CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading link protection config:', error);
    }
    return {};
}

// ฟังก์ชันบันทึกการตั้งค่า
function saveLinkProtectionConfig(config) {
    try {
        const dir = path.dirname(LINK_PROTECTION_CONFIG_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(LINK_PROTECTION_CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving link protection config:', error);
        return false;
    }
}

module.exports = {
    name: "กันลิ้ง",
    description: "ระบบป้องกันการส่งลิ้งในกลุ่ม - เฉพาะแอดมิน",
    nashPrefix: false,
    role: "admin",
    aliases: ["linkprotect", "antilink"],
    usage: "กันลิ้ง [เปิด/ปิด/สถานะ]",
    
    async execute(api, event, args) {
        const { threadID, messageID, senderID } = event;
        
        // โหลดการตั้งค่า
        const config = loadLinkProtectionConfig();
        
        if (args.length === 0) {
            const isEnabled = config[threadID]?.enabled || false;
            const customDomains = config[threadID]?.customDomains || [];
            const whitelist = config[threadID]?.whitelist || [];
            
            let message = "🛡️ การตั้งค่าป้องกันลิ้ง\n";
            message += "═══════════════════\n\n";
            message += `สถานะ: ${isEnabled ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน'}\n`;
            message += `โดเมนที่กัน: ${customDomains.length} รายการ\n`;
            message += `โดเมนที่อนุญาต: ${whitelist.length} รายการ\n\n`;
            message += "🔧 วิธีใช้งาน:\n";
            message += "• กันลิ้ง เปิด - เปิดใช้งาน\n";
            message += "• กันลิ้ง ปิด - ปิดใช้งาน\n";
            message += "• กันลิ้ง เพิ่ม [โดเมน] - เพิ่มโดเมนที่ต้องการกัน\n";
            message += "• กันลิ้ง ลบ [โดเมน] - ลบโดเมนจากรายการกัน\n";
            message += "• กันลิ้ง อนุญาต [โดเมน] - เพิ่มโดเมนที่อนุญาต\n";
            message += "• กันลิ้ง ลบอนุญาต [โดเมน] - ลบโดเมนจากรายการอนุญาต\n";
            message += "• กันลิ้ง รายการ - ดูโดเมนที่กันทั้งหมด\n";
            message += "• กันลิ้ง รายการอนุญาต - ดูโดเมนที่อนุญาตทั้งหมด\n";
            message += "• กันลิ้ง สถานะ - ตรวจสอบสถานะ\n\n";
            message += "⚠️ หมายเหตุ: เมื่อเปิดใช้งาน สมาชิกที่ส่งลิ้งจะถูกเตะออกจากกลุ่มทันที!\n";
            message += "✅ โดเมนในรายการอนุญาตจะไม่ถูกกัน";
            
            return api.sendMessage(message, threadID, messageID);
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
            case 'เปิด':
            case 'on':
            case 'enable':
                if (!config[threadID]) config[threadID] = {};
                config[threadID].enabled = true;
                if (!config[threadID].customDomains) config[threadID].customDomains = [];
                if (!config[threadID].whitelist) config[threadID].whitelist = [];
                saveLinkProtectionConfig(config);
                
                return api.sendMessage(
                    "🟢 เปิดใช้งานการป้องกันลิ้งแล้ว!\n\n" +
                    "⚠️ สมาชิกที่ส่งลิ้งจะถูกเตะออกจากกลุ่มทันที\n\n" +
                    "🔗 ลิ้งที่จะถูกกัน:\n" +
                    "• http://\n" +
                    "• https://\n" +
                    "• www.\n" +
                    "• .com, .net, .org\n" +
                    "• และโดเมนพิเศษที่เพิ่มเติม",
                    threadID, messageID
                );
                
            case 'ปิด':
            case 'off':
            case 'disable':
                if (!config[threadID]) config[threadID] = {};
                config[threadID].enabled = false;
                saveLinkProtectionConfig(config);
                
                return api.sendMessage(
                    "🔴 ปิดใช้งานการป้องกันลิ้งแล้ว",
                    threadID, messageID
                );
                
            case 'เพิ่ม':
            case 'add':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุโดเมนที่ต้องการเพิ่ม\nตัวอย่าง: กันลิ้ง เพิ่ม youtube.com",
                        threadID, messageID
                    );
                }
                
                const domainToAdd = args[1].toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
                if (!config[threadID]) config[threadID] = { enabled: false, customDomains: [], whitelist: [] };
                if (!config[threadID].customDomains) config[threadID].customDomains = [];
                
                if (config[threadID].customDomains.includes(domainToAdd)) {
                    return api.sendMessage(
                        `❌ โดเมน "${domainToAdd}" มีอยู่ในรายการแล้ว`,
                        threadID, messageID
                    );
                }
                
                config[threadID].customDomains.push(domainToAdd);
                saveLinkProtectionConfig(config);
                
                return api.sendMessage(
                    `✅ เพิ่มโดเมน "${domainToAdd}" เรียบร้อยแล้ว\n\n` +
                    `📋 รายการโดเมนทั้งหมด: ${config[threadID].customDomains.length} รายการ`,
                    threadID, messageID
                );
                
            case 'ลบ':
            case 'remove':
            case 'delete':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุโดเมนที่ต้องการลบ\nตัวอย่าง: กันลิ้ง ลบ youtube.com",
                        threadID, messageID
                    );
                }
                
                const domainToRemove = args[1].toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
                if (!config[threadID] || !config[threadID].customDomains) {
                    return api.sendMessage(
                        "❌ ไม่มีโดเมนในรายการ",
                        threadID, messageID
                    );
                }
                
                const domainIndex = config[threadID].customDomains.indexOf(domainToRemove);
                if (domainIndex === -1) {
                    return api.sendMessage(
                        `❌ ไม่พบโดเมน "${domainToRemove}" ในรายการ`,
                        threadID, messageID
                    );
                }
                
                config[threadID].customDomains.splice(domainIndex, 1);
                saveLinkProtectionConfig(config);
                
                return api.sendMessage(
                    `✅ ลบโดเมน "${domainToRemove}" เรียบร้อยแล้ว\n\n` +
                    `📋 รายการโดเมนคงเหลือ: ${config[threadID].customDomains.length} รายการ`,
                    threadID, messageID
                );
                
            case 'อนุญาต':
            case 'allow':
            case 'whitelist':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุโดเมนที่ต้องการอนุญาต\nตัวอย่าง: กันลิ้ง อนุญาต shopee.co.th",
                        threadID, messageID
                    );
                }
                
                const domainToAllow = args[1].toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
                if (!config[threadID]) config[threadID] = { enabled: false, customDomains: [], whitelist: [] };
                if (!config[threadID].whitelist) config[threadID].whitelist = [];
                
                if (config[threadID].whitelist.includes(domainToAllow)) {
                    return api.sendMessage(
                        `❌ โดเมน "${domainToAllow}" มีอยู่ในรายการอนุญาตแล้ว`,
                        threadID, messageID
                    );
                }
                
                config[threadID].whitelist.push(domainToAllow);
                saveLinkProtectionConfig(config);
                
                return api.sendMessage(
                    `✅ เพิ่มโดเมน "${domainToAllow}" ในรายการอนุญาตเรียบร้อยแล้ว\n\n` +
                    `📋 รายการโดเมนที่อนุญาตทั้งหมด: ${config[threadID].whitelist.length} รายการ\n\n` +
                    `💡 โดเมนนี้จะไม่ถูกกันแม้ว่าจะเปิดการป้องกันลิ้ง`,
                    threadID, messageID
                );
                
            case 'ลบอนุญาต':
            case 'removeallow':
            case 'unwhitelist':
                if (args.length < 2) {
                    return api.sendMessage(
                        "❌ กรุณาระบุโดเมนที่ต้องการลบจากรายการอนุญาต\nตัวอย่าง: กันลิ้ง ลบอนุญาต shopee.co.th",
                        threadID, messageID
                    );
                }
                
                const domainToDisallow = args[1].toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
                if (!config[threadID] || !config[threadID].whitelist) {
                    return api.sendMessage(
                        "❌ ไม่มีโดเมนในรายการอนุญาต",
                        threadID, messageID
                    );
                }
                
                const allowIndex = config[threadID].whitelist.indexOf(domainToDisallow);
                if (allowIndex === -1) {
                    return api.sendMessage(
                        `❌ ไม่พบโดเมน "${domainToDisallow}" ในรายการอนุญาต`,
                        threadID, messageID
                    );
                }
                
                config[threadID].whitelist.splice(allowIndex, 1);
                saveLinkProtectionConfig(config);
                
                return api.sendMessage(
                    `✅ ลบโดเมน "${domainToDisallow}" จากรายการอนุญาตเรียบร้อยแล้ว\n\n` +
                    `📋 รายการโดเมนที่อนุญาตคงเหลือ: ${config[threadID].whitelist.length} รายการ`,
                    threadID, messageID
                );
                
            case 'รายการ':
            case 'list':
                const groupConfig = config[threadID];
                if (!groupConfig || !groupConfig.customDomains || groupConfig.customDomains.length === 0) {
                    return api.sendMessage(
                        "📋 รายการโดเมนที่กัน\n" +
                        "═══════════════\n\n" +
                        "🔧 โดเมนพื้นฐาน:\n" +
                        "• http://\n" +
                        "• https://\n" +
                        "• www.\n" +
                        "• .com, .net, .org, .co.th\n" +
                        "• facebook.com\n" +
                        "• youtube.com\n" +
                        "• และอื่นๆ\n\n" +
                        "🔧 โดเมนพิเศษ: ไม่มี",
                        threadID, messageID
                    );
                }
                
                let listMessage = "📋 รายการโดเมนที่กัน\n";
                listMessage += "═══════════════\n\n";
                listMessage += "🔧 โดเมนพื้นฐาน: ใช้งานอยู่\n";
                listMessage += `🔧 โดเมนพิเศษ: ${groupConfig.customDomains.length} รายการ\n\n`;
                
                if (groupConfig.customDomains.length > 0) {
                    listMessage += "📝 โดเมนพิเศษในกลุ่มนี้:\n";
                    groupConfig.customDomains.forEach((domain, index) => {
                        listMessage += `${index + 1}. ${domain}\n`;
                    });
                } else {
                    listMessage += "ไม่มีโดเมนพิเศษ";
                }
                
                return api.sendMessage(listMessage, threadID, messageID);
                
            case 'รายการอนุญาต':
            case 'allowlist':
            case 'whitelistshow':
                const groupWhitelist = config[threadID]?.whitelist || [];
                if (groupWhitelist.length === 0) {
                    return api.sendMessage(
                        "📋 รายการโดเมนที่อนุญาต\n" +
                        "═══════════════\n\n" +
                        "🔧 ไม่มีโดเมนในรายการอนุญาต\n\n" +
                        "💡 ใช้คำสั่ง 'กันลิ้ง อนุญาต [โดเมน]' เพื่อเพิ่มโดเมนที่อนุญาต",
                        threadID, messageID
                    );
                }
                
                let whitelistMessage = "📋 รายการโดเมนที่อนุญาต\n";
                whitelistMessage += "═══════════════\n\n";
                whitelistMessage += `🔧 โดเมนที่อนุญาต: ${groupWhitelist.length} รายการ\n\n`;
                
                whitelistMessage += "📝 โดเมนที่อนุญาตในกลุ่มนี้:\n";
                groupWhitelist.forEach((domain, index) => {
                    whitelistMessage += `${index + 1}. ✅ ${domain}\n`;
                });
                
                whitelistMessage += "\n💡 โดเมนเหล่านี้จะไม่ถูกกันแม้ว่าจะเปิดการป้องกันลิ้ง";
                
                return api.sendMessage(whitelistMessage, threadID, messageID);
                
            case 'สถานะ':
            case 'status':
                const currentConfig = config[threadID];
                const enabled = currentConfig?.enabled || false;
                const customCount = currentConfig?.customDomains?.length || 0;
                const whitelistCount = currentConfig?.whitelist?.length || 0;
                
                let statusMessage = "📊 สถานะการป้องกันลิ้ง\n";
                statusMessage += "═══════════════════\n\n";
                statusMessage += `🔧 สถานะ: ${enabled ? '🟢 เปิดใช้งาน' : '🔴 ปิดใช้งาน'}\n`;
                statusMessage += `📋 โดเมนที่กัน: ${customCount} รายการ\n`;
                statusMessage += `✅ โดเมนที่อนุญาต: ${whitelistCount} รายการ\n`;
                statusMessage += `🛡️ โดเมนพื้นฐาน: ใช้งานอยู่\n`;
                statusMessage += `👑 คำสั่งโดย: แอดมิน\n\n`;
                
                if (enabled) {
                    statusMessage += "⚠️ สมาชิกที่ส่งลิ้งจะถูกเตะออกทันที!\n";
                    if (whitelistCount > 0) {
                        statusMessage += `✅ ยกเว้นโดเมนที่อนุญาต ${whitelistCount} รายการ`;
                    }
                } else {
                    statusMessage += "💡 ใช้คำสั่ง 'กันลิ้ง เปิด' เพื่อเปิดใช้งาน";
                }
                
                return api.sendMessage(statusMessage, threadID, messageID);
                
            default:
                return api.sendMessage(
                    "❌ คำสั่งไม่ถูกต้อง\nใช้: กันลิ้ง [เปิด/ปิด/เพิ่ม/ลบ/อนุญาต/ลบอนุญาต/รายการ/รายการอนุญาต/สถานะ]",
                    threadID, messageID
                );
        }
    }
};
