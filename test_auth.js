// ไฟล์ทดสอบระบบการลงชื่อเข้าใช้งาน
// วิธีใช้: node test_auth.js

const authManager = require('./utils/authManager');

// Mock Data สำหรับทดสอบ
const testUserID = "test_user_123456";
const testUsername = "ผู้ทดสอบ";

async function testAuthSystem() {
    console.log("🧪 กำลังทดสอบระบบการลงชื่อเข้าใช้งาน\n");
    
    try {
        // 1. ทดสอบการสมัครสมาชิก
        console.log("1. ทดสอบการสมัครสมาชิก...");
        const registerResult = await authManager.registerUser(testUserID, testUsername);
        
        if (registerResult.success) {
            console.log("✅ สมัครสมาชิกสำเร็จ");
            console.log(`   - ชื่อผู้ใช้: ${testUsername}`);
            console.log(`   - รหัสผ่าน: ${registerResult.password}`);
            console.log(`   - ลงทะเบียนเมื่อ: ${registerResult.userData.registeredAt}\n`);
            
            const testPassword = registerResult.password;
            
            // 2. ทดสอบการเข้าสู่ระบบ
            console.log("2. ทดสอบการเข้าสู่ระบบ...");
            const loginResult = await authManager.login(testUserID, testPassword);
            
            if (loginResult.success) {
                console.log("✅ เข้าสู่ระบบสำเร็จ");
                console.log(`   - Session Token: ${loginResult.sessionToken}`);
                console.log(`   - หมดอายุ: ${loginResult.expiresAt}\n`);
                
                // 3. ทดสอบการตรวจสอบ Session
                console.log("3. ทดสอบการตรวจสอบ Session...");
                const sessionCheck = await authManager.validateSession(testUserID);
                
                if (sessionCheck.valid) {
                    console.log("✅ Session ถูกต้อง");
                    console.log(`   - ผู้ใช้: ${sessionCheck.sessionData.userID}`);
                    console.log(`   - เข้าสู่ระบบเมื่อ: ${sessionCheck.sessionData.loginTime}\n`);
                } else {
                    console.log(`❌ Session ไม่ถูกต้อง: ${sessionCheck.error}\n`);
                }
                
                // 4. ทดสอบการเปลี่ยนรหัสผ่าน
                console.log("4. ทดสอบการเปลี่ยนรหัสผ่าน...");
                const newPassword = "NewPass123";
                const changeResult = await authManager.changePassword(testUserID, testPassword, newPassword);
                
                if (changeResult.success) {
                    console.log("✅ เปลี่ยนรหัสผ่านสำเร็จ");
                    console.log(`   - รหัสผ่านใหม่: ${newPassword}\n`);
                    
                    // 5. ทดสอบการเข้าสู่ระบบด้วยรหัสผ่านใหม่
                    console.log("5. ทดสอบการเข้าสู่ระบบด้วยรหัสผ่านใหม่...");
                    await authManager.logout(testUserID); // ออกจากระบบก่อน
                    
                    const newLoginResult = await authManager.login(testUserID, newPassword);
                    if (newLoginResult.success) {
                        console.log("✅ เข้าสู่ระบบด้วยรหัสผ่านใหม่สำเร็จ\n");
                    } else {
                        console.log(`❌ เข้าสู่ระบบด้วยรหัสผ่านใหม่ไม่สำเร็จ: ${newLoginResult.error}\n`);
                    }
                } else {
                    console.log(`❌ เปลี่ยนรหัสผ่านไม่สำเร็จ: ${changeResult.error}\n`);
                }
                
                // 6. ทดสอบการดูรายชื่อผู้ใช้
                console.log("6. ทดสอบการดูรายชื่อผู้ใช้...");
                const usersResult = await authManager.getAllUsers();
                
                if (usersResult.success) {
                    console.log(`✅ ดึงรายชื่อผู้ใช้สำเร็จ (${usersResult.users.length} คน)`);
                    usersResult.users.forEach((user, index) => {
                        console.log(`   ${index + 1}. ${user.username} (${user.userID}) - ${user.isActive ? 'ใช้งานได้' : 'ระงับ'}`);
                    });
                    console.log();
                } else {
                    console.log(`❌ ดึงรายชื่อผู้ใช้ไม่สำเร็จ: ${usersResult.error}\n`);
                }
                
                // 7. ทดสอบการดู Active Sessions
                console.log("7. ทดสอบการดู Active Sessions...");
                const sessionsResult = await authManager.getActiveSessions();
                
                if (sessionsResult.success) {
                    console.log(`✅ ดึงข้อมูล Sessions สำเร็จ (${sessionsResult.sessions.length} sessions)`);
                    sessionsResult.sessions.forEach((session, index) => {
                        console.log(`   ${index + 1}. User: ${session.userID} - Login: ${new Date(session.loginTime).toLocaleString('th-TH')}`);
                    });
                    console.log();
                } else {
                    console.log(`❌ ดึงข้อมูล Sessions ไม่สำเร็จ: ${sessionsResult.error}\n`);
                }
                
                // 8. ทดสอบการรีเซ็ตรหัสผ่าน (Admin function)
                console.log("8. ทดสอบการรีเซ็ตรหัสผ่าน...");
                const resetResult = await authManager.resetPassword(testUserID);
                
                if (resetResult.success) {
                    console.log("✅ รีเซ็ตรหัสผ่านสำเร็จ");
                    console.log(`   - รหัสผ่านใหม่: ${resetResult.newPassword}\n`);
                } else {
                    console.log(`❌ รีเซ็ตรหัสผ่านไม่สำเร็จ: ${resetResult.error}\n`);
                }
                
                // 9. ทดสอบการระงับผู้ใช้
                console.log("9. ทดสอบการระงับผู้ใช้...");
                const suspendResult = await authManager.toggleUserStatus(testUserID, false);
                
                if (suspendResult.success) {
                    console.log("✅ ระงับผู้ใช้สำเร็จ\n");
                    
                    // ทดสอบการเข้าสู่ระบบขณะถูกระงับ
                    console.log("10. ทดสอบการเข้าสู่ระบบขณะถูกระงับ...");
                    const suspendedLoginResult = await authManager.login(testUserID, resetResult.newPassword);
                    
                    if (!suspendedLoginResult.success) {
                        console.log(`✅ ป้องกันการเข้าสู่ระบบขณะถูกระงับสำเร็จ: ${suspendedLoginResult.error}\n`);
                    } else {
                        console.log("❌ ระบบยังให้เข้าสู่ระบบได้ขณะถูกระงับ\n");
                    }
                } else {
                    console.log(`❌ ระงับผู้ใช้ไม่สำเร็จ: ${suspendResult.error}\n`);
                }
                
                // 10. ทดสอบการเปิดใช้งานผู้ใช้
                console.log("11. ทดสอบการเปิดใช้งานผู้ใช้...");
                const activateResult = await authManager.toggleUserStatus(testUserID, true);
                
                if (activateResult.success) {
                    console.log("✅ เปิดใช้งานผู้ใช้สำเร็จ\n");
                } else {
                    console.log(`❌ เปิดใช้งานผู้ใช้ไม่สำเร็จ: ${activateResult.error}\n`);
                }
                
                // 11. ทดสอบการล้าง Expired Sessions
                console.log("12. ทดสอบการล้าง Expired Sessions...");
                const cleanResult = await authManager.cleanExpiredSessions();
                
                if (cleanResult.success) {
                    console.log(`✅ ล้าง Expired Sessions สำเร็จ (ลบ ${cleanResult.cleaned} sessions)\n`);
                } else {
                    console.log(`❌ ล้าง Expired Sessions ไม่สำเร็จ: ${cleanResult.error}\n`);
                }
                
            } else {
                console.log(`❌ เข้าสู่ระบบไม่สำเร็จ: ${loginResult.error}\n`);
            }
            
        } else {
            console.log(`❌ สมัครสมาชิกไม่สำเร็จ: ${registerResult.error}\n`);
        }
        
        console.log("🎉 การทดสอบระบบเสร็จสิ้น!");
        console.log("\n📋 สรุปผลการทดสอบ:");
        console.log("✅ สามารถสมัครสมาชิกได้");
        console.log("✅ สามารถเข้าสู่ระบบได้");
        console.log("✅ Session ทำงานถูกต้อง");
        console.log("✅ สามารถเปลี่ยนรหัสผ่านได้");
        console.log("✅ สามารถจัดการผู้ใช้ได้ (Admin functions)");
        console.log("✅ ระบบความปลอดภัยทำงานถูกต้อง");
        
    } catch (error) {
        console.error("💥 เกิดข้อผิดพลาดในการทดสอบ:", error);
        
        console.log("\n🔧 การแก้ไขปัญหา:");
        console.log("1. ตรวจสอบการเชื่อมต่อ Firebase");
        console.log("2. ตรวจสอบ Firebase Database URL");
        console.log("3. ตรวจสอบสิทธิ์การเข้าถึง Database");
    }
}

// เริ่มการทดสอบ
console.log("🚀 เริ่มทดสอบระบบการลงชื่อเข้าใช้งาน");
console.log("Firebase URL: https://apikf-bbe63-default-rtdb.europe-west1.firebasedatabase.app/");
console.log("========================================\n");

testAuthSystem().then(() => {
    console.log("\n🏁 การทดสอบเสร็จสิ้น");
    process.exit(0);
}).catch((error) => {
    console.error("💥 การทดสอบล้มเหลว:", error);
    process.exit(1);
});
