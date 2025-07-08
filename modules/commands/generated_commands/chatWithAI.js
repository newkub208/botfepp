module.exports = {
    name: "chatWithAI",
    description: "คุยกับ AI",
    version: "1.0.0",
    aliases: ["ai"],
    nashPrefix: false,
    cooldowns: 10,
    async execute(api, event, args, prefix) {
        const { threadID, messageID } = event;
        const userMessage = args.join(" ");

        const response = await fetch(`https://kaiz-apis.gleeze.com/api/deepseek-v3?ask=${encodeURIComponent(userMessage)}&apikey=e62d60dd-8853-4233-bbcb-9466b4cbc265`);
        const data = await response.json();

        api.sendMessage(data.response, threadID, messageID);
    }
};