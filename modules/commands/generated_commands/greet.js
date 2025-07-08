module.exports = {
    name: "greet",
    description: "ตอบสวัสดีดีแล้ว",
    version: "1.0.0",
    aliases: ["hi"],
    nashPrefix: false,
    cooldowns: 10,
    async execute(api, event, args, prefix) {
        const { threadID, messageID } = event;
        api.sendMessage("สวัสดีดีแล้ว", threadID, messageID);
    }
};