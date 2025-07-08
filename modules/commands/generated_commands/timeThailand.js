module.exports = {
    name: "timeThailand",
    description: "แสดงเวลาปัจจุบันในไทย",
    version: "1.0.0",
    aliases: ["time"],
    nashPrefix: false,
    cooldowns: 10,
    async execute(api, event, args, prefix) {
        const { threadID, messageID } = event;
        const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok', hour12: false });
        api.sendMessage(`เวลาปัจจุบันในไทย: ${currentTime}`, threadID, messageID);
    }
};