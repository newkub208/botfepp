// ไฟล์ทดสอบระบบเช็กคำหยาบ
// วิธีใช้: node test_badword.js

const badwordModule = require('./modules/commands/badword.js');

// Mock API และ Event สำหรับการทดสอบ
const mockAPI = {
    sendMessage: (message, threadID, messageID) => {
        console.log(`[SEND MESSAGE] ThreadID: ${threadID}`);
        console.log(`Message: ${message}`);
        console.log('---');
    },
    removeUserFromGroup: (userID, threadID) => {
        console.log(`[KICK USER] Removed user ${userID} from thread ${threadID}`);
        return Promise.resolve();
    }
};

const mockEvent = {
    threadID: "test_group_123",
    senderID: "test_user_456", 
    messageID: "msg_789",
    body: ""
};

// ทดสอบฟังก์ชันต่างๆ
async function testBadwordSystem() {
    console.log("🧪 กำลังทดสอบระบบเช็กคำหยาบ\n");
    
    // ทดสอบการเปิดใช้งาน
    console.log("1. ทดสอบการเปิดใช้งาน");
    await badwordModule.execute(mockAPI, mockEvent, ["เปิด"]);
    
    // ทดสอบการเพิ่มคำหยาบ
    console.log("\n2. ทดสอบการเพิ่มคำหยาบ");
    await badwordModule.execute(mockAPI, mockEvent, ["เพิ่ม", "โฆษณา"]);
    
    // ทดสอบการดูรายการ
    console.log("\n3. ทดสอบการดูรายการคำหยาบ");
    await badwordModule.execute(mockAPI, mockEvent, ["รายการ"]);
    
    // ทดสอบการเช็กคำหยาบ
    console.log("\n4. ทดสอบการเช็กคำหยาบ");
    const testEvent = { ...mockEvent, body: "สัสครับ" };
    await badwordModule.checkMessage(mockAPI, testEvent);
    
    // ทดสอบกับคำหยาบพิเศษ
    console.log("\n5. ทดสอบกับคำหยาบพิเศษ");
    const testEvent2 = { ...mockEvent, body: "โฆษณาครับ" };
    await badwordModule.checkMessage(mockAPI, testEvent2);
    
    console.log("\n✅ การทดสอบเสร็จสิ้น");
}

// เรียกใช้การทดสอบ
testBadwordSystem().catch(console.error);
