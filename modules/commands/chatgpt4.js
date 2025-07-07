const axios = require("axios");

module.exports = {
    name: "gpt4",
    description: "HAHHAHAHAH",
    nashPrefix: false,
    version: "1.0.1",
    cooldowns: 5,
    aliases: ["chatgpt4"],
    execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;
        let prompt = args.join(" ");
        if (!prompt) return api.sendMessage("Please enter a prompt.", threadID, messageID);

        if (!global.handle) global.handle = {};
        if (!global.handle.replies) global.handle.replies = {};

        api.sendMessage("[ GPT 4 ]\n\nplease wait...", threadID, (err, info) => {
            if (err) return;

            const url = `https://zen-api.gleeze.com/api/gpt4?prompt=${encodeURIComponent(prompt)}&uid=${senderID}`;

            axios.get(url)
                .then(res => {
                    const data = res.data;
                    const reply = data.response || data.message || "⚠️ No reply received.";
                    api.editMessage(reply, info.messageID);

                    global.handle.replies[info.messageID] = {
                        cmdname: module.exports.name,
                        this_mid: info.messageID,
                        this_tid: info.threadID,
                        tid: threadID,
                        mid: messageID,
                    };
                })
                .catch(() => {
                    api.editMessage("❌ Failed to get response.", info.messageID);
                });
        }, messageID);
    },
};
