const axios = require('axios');
const bcrypt = require('bcryptjs');

// Firebase Realtime Database URL
const FIREBASE_URL = 'https://apikf-bbe63-default-rtdb.europe-west1.firebasedatabase.app';

class UserManager {
    constructor() {
        this.firebaseUrl = FIREBASE_URL;
    }

    // สร้างรหัสผ่านที่เข้ารหัสแล้ว
    async hashPassword(password) {
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
    }

    // ตรวจสอบรหัสผ่าน
    async verifyPassword(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    // ลงทะเบียนผู้ใช้ใหม่
    async registerUser(userId, password) {
        try {
            // ตรวจสอบว่าผู้ใช้มีอยู่แล้วหรือไม่
            const existingUser = await this.getUserById(userId);
            if (existingUser) {
                return { success: false, message: 'ผู้ใช้นี้มีอยู่ในระบบแล้ว' };
            }

            // เข้ารหัสรหัสผ่าน
            const hashedPassword = await this.hashPassword(password);

            // สร้างข้อมูลผู้ใช้
            const userData = {
                userId: userId,
                password: hashedPassword,
                isActive: true,
                registeredAt: new Date().toISOString(),
                lastLogin: null,
                loginCount: 0
            };

            // บันทึกลง Firebase
            const response = await axios.put(
                `${this.firebaseUrl}/users/${userId}.json`,
                userData
            );

            if (response.status === 200) {
                return { 
                    success: true, 
                    message: 'ลงทะเบียนสำเร็จ',
                    userId: userId
                };
            } else {
                return { success: false, message: 'เกิดข้อผิดพลาดในการลงทะเบียน' };
            }
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
        }
    }

    // เข้าสู่ระบบ
    async loginUser(userId, password) {
        try {
            // ดึงข้อมูลผู้ใช้จาก Firebase
            const user = await this.getUserById(userId);
            if (!user) {
                return { success: false, message: 'ไม่พบผู้ใช้ในระบบ' };
            }

            // ตรวจสอบสถานะผู้ใช้
            if (!user.isActive) {
                return { success: false, message: 'บัญชีผู้ใช้ถูกระงับ' };
            }

            // ตรวจสอบรหัสผ่าน
            const isPasswordValid = await this.verifyPassword(password, user.password);
            if (!isPasswordValid) {
                return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
            }

            // อัปเดตข้อมูลการเข้าสู่ระบบ
            await this.updateLoginInfo(userId);

            return { 
                success: true, 
                message: 'เข้าสู่ระบบสำเร็จ',
                userId: userId,
                loginCount: user.loginCount + 1
            };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อ' };
        }
    }

    // ดึงข้อมูลผู้ใช้จาก ID
    async getUserById(userId) {
        try {
            const response = await axios.get(`${this.firebaseUrl}/users/${userId}.json`);
            return response.data;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    // ตรวจสอบว่าผู้ใช้เข้าสู่ระบบแล้วหรือไม่
    async isUserLoggedIn(userId) {
        try {
            const response = await axios.get(`${this.firebaseUrl}/sessions/${userId}.json`);
            const session = response.data;
            
            if (!session) return false;
            
            // ตรวจสอบว่า session หมดอายุหรือไม่ (24 ชั่วโมง)
            const sessionTime = new Date(session.loginTime);
            const now = new Date();
            const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);
            
            if (hoursDiff > 24) {
                // ลบ session ที่หมดอายุ
                await this.logoutUser(userId);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Check login error:', error);
            return false;
        }
    }

    // อัปเดตข้อมูลการเข้าสู่ระบบ
    async updateLoginInfo(userId) {
        try {
            const now = new Date().toISOString();
            
            // อัปเดตข้อมูลผู้ใช้
            const user = await this.getUserById(userId);
            if (user) {
                user.lastLogin = now;
                user.loginCount = (user.loginCount || 0) + 1;
                await axios.put(`${this.firebaseUrl}/users/${userId}.json`, user);
            }

            // สร้าง session
            const sessionData = {
                userId: userId,
                loginTime: now,
                isActive: true
            };
            await axios.put(`${this.firebaseUrl}/sessions/${userId}.json`, sessionData);
            
            return true;
        } catch (error) {
            console.error('Update login info error:', error);
            return false;
        }
    }

    // ออกจากระบบ
    async logoutUser(userId) {
        try {
            // ลบ session
            await axios.delete(`${this.firebaseUrl}/sessions/${userId}.json`);
            return { success: true, message: 'ออกจากระบบแล้ว' };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, message: 'เกิดข้อผิดพลาดในการออกจากระบบ' };
        }
    }

    // ดึงรายการผู้ใช้ทั้งหมด (สำหรับ admin)
    async getAllUsers() {
        try {
            const response = await axios.get(`${this.firebaseUrl}/users.json`);
            return response.data || {};
        } catch (error) {
            console.error('Get all users error:', error);
            return {};
        }
    }

    // ระงับ/ยกเลิกระงับผู้ใช้
    async toggleUserStatus(userId, isActive) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                return { success: false, message: 'ไม่พบผู้ใช้' };
            }

            user.isActive = isActive;
            await axios.put(`${this.firebaseUrl}/users/${userId}.json`, user);

            // ถ้าระงับผู้ใช้ ให้ลบ session ด้วย
            if (!isActive) {
                await this.logoutUser(userId);
            }

            return { 
                success: true, 
                message: isActive ? 'เปิดใช้งานบัญชีแล้ว' : 'ระงับบัญชีแล้ว' 
            };
        } catch (error) {
            console.error('Toggle user status error:', error);
            return { success: false, message: 'เกิดข้อผิดพลาด' };
        }
    }

    // ลบผู้ใช้
    async deleteUser(userId) {
        try {
            // ลบผู้ใช้และ session
            await axios.delete(`${this.firebaseUrl}/users/${userId}.json`);
            await axios.delete(`${this.firebaseUrl}/sessions/${userId}.json`);
            
            return { success: true, message: 'ลบผู้ใช้แล้ว' };
        } catch (error) {
            console.error('Delete user error:', error);
            return { success: false, message: 'เกิดข้อผิดพลาดในการลบผู้ใช้' };
        }
    }

    // เปลี่ยนรหัสผ่าน
    async changePassword(userId, oldPassword, newPassword) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                return { success: false, message: 'ไม่พบผู้ใช้' };
            }

            // ตรวจสอบรหัสผ่านเก่า
            const isOldPasswordValid = await this.verifyPassword(oldPassword, user.password);
            if (!isOldPasswordValid) {
                return { success: false, message: 'รหัสผ่านเก่าไม่ถูกต้อง' };
            }

            // เข้ารหัสรหัสผ่านใหม่
            const hashedNewPassword = await this.hashPassword(newPassword);
            user.password = hashedNewPassword;
            
            await axios.put(`${this.firebaseUrl}/users/${userId}.json`, user);
            
            return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
        } catch (error) {
            console.error('Change password error:', error);
            return { success: false, message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' };
        }
    }
}

module.exports = new UserManager();
