const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, get, child, remove, push } = require('firebase/database');

// การตั้งค่า Firebase
const firebaseConfig = {
    databaseURL: "https://apikf-bbe63-default-rtdb.europe-west1.firebasedatabase.app/"
};

// เริ่มต้น Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

class AuthManager {
    constructor() {
        this.database = database;
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 ชั่วโมง
    }

    // สร้างรหัสผ่านแบบสุ่ม
    generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    // สร้าง session token
    generateSessionToken() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    // ลงทะเบียนผู้ใช้ใหม่
    async registerUser(userID, username) {
        try {
            const password = this.generatePassword();
            const userData = {
                userID: userID,
                username: username,
                password: password,
                registeredAt: new Date().toISOString(),
                isActive: true,
                lastLogin: null,
                loginCount: 0
            };

            await set(ref(this.database, `users/${userID}`), userData);
            
            console.log(`[AUTH] Registered new user: ${username} (${userID})`);
            return { success: true, password: password, userData: userData };
        } catch (error) {
            console.error('[AUTH] Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
    async userExists(userID) {
        try {
            const snapshot = await get(child(ref(this.database), `users/${userID}`));
            return snapshot.exists();
        } catch (error) {
            console.error('[AUTH] User check error:', error);
            return false;
        }
    }

    // เข้าสู่ระบบ
    async login(userID, password) {
        try {
            const snapshot = await get(child(ref(this.database), `users/${userID}`));
            
            if (!snapshot.exists()) {
                return { success: false, error: 'ไม่พบผู้ใช้งาน' };
            }

            const userData = snapshot.val();
            
            if (!userData.isActive) {
                return { success: false, error: 'บัญชีถูกระงับการใช้งาน' };
            }

            if (userData.password !== password) {
                return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' };
            }

            // สร้าง session
            const sessionToken = this.generateSessionToken();
            const sessionData = {
                userID: userID,
                token: sessionToken,
                loginTime: new Date().toISOString(),
                expiresAt: new Date(Date.now() + this.sessionTimeout).toISOString(),
                isActive: true
            };

            // บันทึก session
            await set(ref(this.database, `sessions/${userID}`), sessionData);

            // อัปเดตข้อมูลการเข้าสู่ระบบ
            await set(ref(this.database, `users/${userID}/lastLogin`), new Date().toISOString());
            await set(ref(this.database, `users/${userID}/loginCount`), (userData.loginCount || 0) + 1);

            console.log(`[AUTH] User logged in: ${userData.username} (${userID})`);
            return { 
                success: true, 
                sessionToken: sessionToken,
                userData: userData,
                expiresAt: sessionData.expiresAt
            };
        } catch (error) {
            console.error('[AUTH] Login error:', error);
            return { success: false, error: error.message };
        }
    }

    // ออกจากระบบ
    async logout(userID) {
        try {
            await remove(ref(this.database, `sessions/${userID}`));
            console.log(`[AUTH] User logged out: ${userID}`);
            return { success: true };
        } catch (error) {
            console.error('[AUTH] Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    // ตรวจสอบ session
    async validateSession(userID) {
        try {
            const snapshot = await get(child(ref(this.database), `sessions/${userID}`));
            
            if (!snapshot.exists()) {
                return { valid: false, error: 'ไม่พบ session' };
            }

            const sessionData = snapshot.val();
            const now = new Date();
            const expiresAt = new Date(sessionData.expiresAt);

            if (now > expiresAt) {
                // Session หมดอายุ - ลบออก
                await remove(ref(this.database, `sessions/${userID}`));
                return { valid: false, error: 'Session หมดอายุ' };
            }

            if (!sessionData.isActive) {
                return { valid: false, error: 'Session ไม่ใช่งาน' };
            }

            return { valid: true, sessionData: sessionData };
        } catch (error) {
            console.error('[AUTH] Session validation error:', error);
            return { valid: false, error: error.message };
        }
    }

    // เปลี่ยนรหัสผ่าน
    async changePassword(userID, oldPassword, newPassword) {
        try {
            const snapshot = await get(child(ref(this.database), `users/${userID}`));
            
            if (!snapshot.exists()) {
                return { success: false, error: 'ไม่พบผู้ใช้งาน' };
            }

            const userData = snapshot.val();
            
            if (userData.password !== oldPassword) {
                return { success: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' };
            }

            await set(ref(this.database, `users/${userID}/password`), newPassword);
            await set(ref(this.database, `users/${userID}/passwordChangedAt`), new Date().toISOString());

            console.log(`[AUTH] Password changed for user: ${userID}`);
            return { success: true };
        } catch (error) {
            console.error('[AUTH] Password change error:', error);
            return { success: false, error: error.message };
        }
    }

    // รีเซ็ตรหัสผ่าน (สำหรับ admin)
    async resetPassword(userID) {
        try {
            const newPassword = this.generatePassword();
            
            await set(ref(this.database, `users/${userID}/password`), newPassword);
            await set(ref(this.database, `users/${userID}/passwordResetAt`), new Date().toISOString());
            
            // ลบ session ทั้งหมด
            await remove(ref(this.database, `sessions/${userID}`));

            console.log(`[AUTH] Password reset for user: ${userID}`);
            return { success: true, newPassword: newPassword };
        } catch (error) {
            console.error('[AUTH] Password reset error:', error);
            return { success: false, error: error.message };
        }
    }

    // ระงับ/เปิดใช้งานผู้ใช้
    async toggleUserStatus(userID, isActive) {
        try {
            await set(ref(this.database, `users/${userID}/isActive`), isActive);
            
            if (!isActive) {
                // ถ้าระงับการใช้งาน ให้ลบ session
                await remove(ref(this.database, `sessions/${userID}`));
            }

            console.log(`[AUTH] User ${userID} status changed to: ${isActive ? 'active' : 'suspended'}`);
            return { success: true };
        } catch (error) {
            console.error('[AUTH] Status change error:', error);
            return { success: false, error: error.message };
        }
    }

    // ดูรายชื่อผู้ใช้ทั้งหมด
    async getAllUsers() {
        try {
            const snapshot = await get(child(ref(this.database), 'users'));
            
            if (!snapshot.exists()) {
                return { success: true, users: [] };
            }

            const users = [];
            snapshot.forEach((userSnapshot) => {
                const userData = userSnapshot.val();
                users.push({
                    userID: userData.userID,
                    username: userData.username,
                    isActive: userData.isActive,
                    registeredAt: userData.registeredAt,
                    lastLogin: userData.lastLogin,
                    loginCount: userData.loginCount || 0
                });
            });

            return { success: true, users: users };
        } catch (error) {
            console.error('[AUTH] Get users error:', error);
            return { success: false, error: error.message };
        }
    }

    // ดู session ที่ใช้งานอยู่
    async getActiveSessions() {
        try {
            const snapshot = await get(child(ref(this.database), 'sessions'));
            
            if (!snapshot.exists()) {
                return { success: true, sessions: [] };
            }

            const sessions = [];
            const now = new Date();

            snapshot.forEach((sessionSnapshot) => {
                const sessionData = sessionSnapshot.val();
                const expiresAt = new Date(sessionData.expiresAt);
                
                if (now <= expiresAt && sessionData.isActive) {
                    sessions.push(sessionData);
                }
            });

            return { success: true, sessions: sessions };
        } catch (error) {
            console.error('[AUTH] Get sessions error:', error);
            return { success: false, error: error.message };
        }
    }

    // ล้าง session ที่หมดอายุ
    async cleanExpiredSessions() {
        try {
            const snapshot = await get(child(ref(this.database), 'sessions'));
            
            if (!snapshot.exists()) {
                return { success: true, cleaned: 0 };
            }

            const now = new Date();
            let cleanedCount = 0;

            for (const sessionSnapshot of snapshot.val()) {
                const sessionData = sessionSnapshot.val();
                const expiresAt = new Date(sessionData.expiresAt);
                
                if (now > expiresAt) {
                    await remove(ref(this.database, `sessions/${sessionData.userID}`));
                    cleanedCount++;
                }
            }

            console.log(`[AUTH] Cleaned ${cleanedCount} expired sessions`);
            return { success: true, cleaned: cleanedCount };
        } catch (error) {
            console.error('[AUTH] Clean sessions error:', error);
            return { success: false, error: error.message };
        }
    }
}

// สร้าง instance เดียวสำหรับทั้งระบบ
const authManager = new AuthManager();

module.exports = authManager;
