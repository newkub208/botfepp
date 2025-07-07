// ไฟล์ทดสอบระบบป้องกันกลุ่ม
// วิธีใช้: node test_protect.js

const protectModule = require('./modules/commands/protect.js');

// Mock API และ Event สำหรับการทดสอบ
const mockAPI = {
    sendMessage: (message, threadID, messageID) => {
        console.log(`[SEND MESSAGE] ThreadID: ${threadID}`);
        console.log(`Message: ${message}`);
        console.log('---');
    },
    getThreadInfo: async (threadID) => {
        return {
            threadName: "กลุ่มทดสอบ",
            threadType: 2,
            participantIDs: ["123", "456", "789"],
            adminIDs: [{ id: "123" }],
            imageSrc: "https://example.com/group.jpg",
            emoji: "🔥",
            color: "#0084ff",
            userInfo: {
                "456": { name: "ผู้ใช้ A", nickname: "A" },
                "789": { name: "ผู้ใช้ B", nickname: null }
            }
        };
    },
    getCurrentUserID: () => "123",
    setTitle: async (title, threadID) => {
        console.log(`[SET TITLE] Changed title to: ${title} in thread ${threadID}`);
    },
    changeNickname: async (nickname, threadID, userID) => {
        console.log(`[CHANGE NICKNAME] Changed nickname to: ${nickname} for user ${userID} in thread ${threadID}`);
    }
};

const mockEvent = {
    threadID: "test_group_123",
    senderID: "test_user_456", 
    messageID: "msg_789"
};

// ทดสอบฟังก์ชันต่างๆ
async function testProtectSystem() {
    console.log("🧪 กำลังทดสอบระบบป้องกันกลุ่ม\n");
    
    // ทดสอบการเปิดใช้งาน
    console.log("1. ทดสอบการเปิดใช้งาน");
    await protectModule.execute(mockAPI, mockEvent, ["เปิด"]);
    
    // ทดสอบการตั้งค่าป้องกันชื่อกลุ่ม
    console.log("\n2. ทดสอบการเปิดป้องกันชื่อกลุ่ม");
    await protectModule.execute(mockAPI, mockEvent, ["กลุ่ม", "เปิด"]);
    
    // ทดสอบการตั้งค่าป้องกันชื่อผู้ใช้
    console.log("\n3. ทดสอบการเปิดป้องกันชื่อผู้ใช้");
    await protectModule.execute(mockAPI, mockEvent, ["ชื่อ", "เปิด"]);
    
    // ทดสอบการบันทึกข้อมูล
    console.log("\n4. ทดสอบการบันทึกข้อมูล");
    await protectModule.execute(mockAPI, mockEvent, ["บันทึก"]);
    
    // ทดสอบการดูสถานะ
    console.log("\n5. ทดสอบการดูสถานะ");
    await protectModule.execute(mockAPI, mockEvent, ["สถานะ"]);
    
    // ทดสอบการคืนค่า
    console.log("\n6. ทดสอบการคืนค่า");
    await protectModule.execute(mockAPI, mockEvent, ["คืนค่า"]);
    
    // ทดสอบการป้องกันเมื่อมีการเปลี่ยนแปลง
    console.log("\n7. ทดสอบการป้องกันการเปลี่ยนชื่อกลุ่ม");
    const mockGroupNameEvent = {
        threadID: "test_group_123",
        logMessageType: "log:thread-name",
        logMessageData: { name: "ชื่อใหม่" }
    };
    await protectModule.protectHandler.onGroupNameChange(mockAPI, mockGroupNameEvent);
    
    console.log("\n8. ทดสอบการป้องกันการเปลี่ยนชื่อผู้ใช้");
    const mockNicknameEvent = {
        threadID: "test_group_123",
        logMessageType: "log:user-nickname",
        logMessageData: { participant_id: "456" }
    };
    await protectModule.protectHandler.onNicknameChange(mockAPI, mockNicknameEvent);
    
    console.log("\n✅ การทดสอบเสร็จสิ้น");
}

// เรียกใช้การทดสอบ
testProtectSystem().catch(console.error);
