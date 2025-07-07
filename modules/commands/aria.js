const axios = require("axios");

module.exports = {
    name: "aria",
    description: "makipag chat kalang ay aria kinginamo gago",
    nashPrefix: false,
    version: "1.0.0",
    cooldowns: 5,
    aliases: ["aria"],
    execute(api, event, args, prefix) {
        const { threadID, messageID, senderID } = event;
        let prompt = args.join(" ");
        if (!prompt) return api.sendMessage("Please enter a prompt.", threadID, messageID);

        if (!global.handle) global.handle = {};
        if (!global.handle.replies) global.handle.replies = {};

        api.sendMessage(
            "[ ARIA ]\n\nplease wait...",
            threadID,
            (err, info) => {
                if (err) return;

                const url = `${global.NashBot.JOSHUA}api/aria?ask=${encodeURIComponent(prompt)}&uid=1&apikey=609efa09-3ed5-4132-8d03-d6f8ca11b527`;

                axios.get(url)
                    .then(response => {
                        const reply = response.data.response;
                        api.editMessage(reply, info.messageID);
                        global.handle.replies[info.messageID] = {
                            cmdname: module.exports.name,
                            this_mid: info.messageID,
                            this_tid: info.threadID,
                            tid: threadID,
                            mid: messageID,
                        };
                    })
                    .catch(error => {
                        api.editMessage("❌ Failed to get ARIA response.", info.messageID);
                    });
            },
            messageID
        );
    },
};
