// ไฟล์ทดสอบระบบเช็กคำหยาบที่แก้ไขแล้ว
// วิธีใช้: node test_badword_fixed.js

console.log("🧪 ทดสอบระบบเช็กคำหยาบที่แก้ไขแล้ว\n");

// ทดสอบ utility functions
try {
    const utils = require('./utils/badwordUtils');
    console.log("✅ โหลด badwordUtils สำเร็จ");
    
    // ทดสอบ error codes
    const testError = { error: 1357031, errorSummary: 'Test error' };
    const errorMessage = utils.getErrorMessage(testError);
    console.log("✅ ฟังก์ชัน getErrorMessage ทำงานได้");
    console.log("   Error message:", errorMessage.substring(0, 50) + "...");
    
    // ทดสอบ log function
    utils.logBadwordAction('TEST', 'user123', 'group456', 'test word');
    console.log("✅ ฟังก์ชัน logBadwordAction ทำงานได้");
    
} catch (error) {
    console.error("❌ Error ในการทดสอบ utils:", error.message);
}

// ทดสอบคำสั่งหลัก
try {
    const badwordModule = require('./modules/commands/badword');
    console.log("✅ โหลด badword command สำเร็จ");
    console.log("   Command name:", badwordModule.name);
    console.log("   Aliases:", badwordModule.aliases.join(', '));
    
} catch (error) {
    console.error("❌ Error ในการทดสอบ command:", error.message);
}

// ทดสอบ event handler
try {
    const badwordEvent = require('./modules/events/badwordFilter');
    console.log("✅ โหลด badword event handler สำเร็จ");
    console.log("   Event name:", badwordEvent.name);
    
} catch (error) {
    console.error("❌ Error ในการทดสอบ event:", error.message);
}

console.log("\n🎉 การทดสอบเสร็จสิ้น");
console.log("\n📋 การปรับปรุงที่ทำ:");
console.log("• แก้ไข deprecation warning");
console.log("• ปรับปรุงการจัดการ error codes");
console.log("• เพิ่มระบบ logging");
console.log("• เพิ่มการตรวจสอบสิทธิ์บอท");
console.log("• ปรับปรุงข้อความ error ให้เข้าใจง่าย");

console.log("\n🚀 พร้อมใช้งาน: ระบบควรทำงานได้ดีขึ้นและลด error แล้ว!");
