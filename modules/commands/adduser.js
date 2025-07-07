module.exports = {
    name: "เพิ่มสมาชิก",
    description: "เพิ่มสมาชิกในกลุ่มแชทโดยใช้ UID",
    nashPrefix: false,
    version: "1.0.0",
    role: "admin",
    cooldowns: 5,
    aliases: ["adduser", "เพิ่ม"],
    async execute(api, event, args) {
        const { threadID, messageID } = event;
        const uid = args[0];

        if (!uid) {
            return api.sendMessage(
                "[ เพิ่มสมาชิก ]\n\n" +
                "❗ กรุณาระบุ UID ที่ต้องการเพิ่ม\n\nตัวอย่าง: เพิ่มสมาชิก 1234567890",
                threadID,
                messageID
            );
        }

        api.sendMessage(
            "[ เพิ่มสมาชิก ]\n\n" +
            "กำลังเพิ่มสมาชิก...",
            threadID,
            async (err, info) => {
                if (err) return;

                try {
                    await api.addUserToGroup(uid, threadID);
                    api.editMessage(
                        "[ เพิ่มสมาชิก ]\n\n" +
                        "เพิ่มสมาชิกเรียบร้อยแล้ว!\n\nวิธีลบข้อความ: รีแอ็คข้อความด้วยไลค์ (👍) หากคุณเป็นผู้ส่ง บอทจะลบข้อความให้อัตโนมัติ",
                        info.messageID
                    );
                } catch (error) {
                    api.sendMessage(
                        "❌ ไม่สามารถเพิ่มสมาชิกได้ กรุณาตรวจสอบ UID และลองใหม่อีกครั้ง",
                        threadID,
                        messageID
                    );
                }
            },
            messageID
        );
    },
};