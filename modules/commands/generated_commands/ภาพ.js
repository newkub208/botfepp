module.exports = {
    name: "ภาพ",
    description: "ส่งรูปภาพที่คุณต้องการ",
    version: "1.0.0",
    aliases: ["รูป", "show"],
    nashPrefix: false,
    cooldowns: 5,
    async execute(api, event, args, prefix) {
        const { threadID, messageID, senderID, mentions = {}, body = "" } = event;
        
        const mentionList = typeof mentions === 'object' && mentions !== null ? mentions : {};
        const mentionIds = Object.keys(mentionList);
        
        const messageText = body || "";
        
        const imageUrl = "https://iili.io/FVO3GEB.jpg";

        try {
            api.sendMessage({
                body: "นี่คือภาพที่ฉันส่งให้คุณค่ะ 😊\nขอให้มีความสุขกับการชมนะคะ!",
                attachment: [imageUrl]
            }, threadID, messageID);
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการส่งภาพ:", error);
            api.sendMessage("ขออภัยค่ะ เกิดข้อผิดพลาดในการส่งภาพ ลองใหม่อีกครั้งในภายหลังนะคะ.", threadID, messageID);
        }
    }
};