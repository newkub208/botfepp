module.exports = {
    name: "showLink",
    description: "แสดงลิ้งค์ไปยัง Facebook",
    version: "1.0.0",
    aliases: ["link"],
    nashPrefix: true,
    cooldowns: 5,
    async execute(api, event, args, prefix) {
        const { threadID, messageID } = event;
        api.sendMessage("🔗 Facebook Link: https://www.facebook.com/share/v/1GW4LbwdSt/", threadID, messageID);
    }
};