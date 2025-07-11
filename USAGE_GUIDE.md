# การใช้งานระบบเตะสมาชิกใหม่

## ขั้นตอนการทำงาน

### 1. สมาชิกใหม่เข้าร่วม
- ระบบจะส่งข้อความต้อนรับพร้อมคำเตือน
- เริ่มจับเวลา 10 นาที

### 2. การตรวจสอบ
- ระบบตรวจสอบทุก 30 วินาที
- หากสมาชิกใหม่ส่งข้อความใดๆ จะปลอดภัย
- หากไม่ส่งข้อความภายใน 10 นาที จะถูกเตะออก

### 3. คำสั่งจัดการ (สำหรับแอดมิน)

#### ดูสถานะสมาชิกใหม่:
```
/เตะใหม่ สถานะ
```
จะแสดง:
- รายชื่อสมาชิกใหม่ที่รอเวลา
- เวลาที่เหลือของแต่ละคน
- เวลาที่เข้าร่วม

#### ล้างข้อมูลทั้งหมด:
```
/เตะใหม่ ล้าง
```
ใช้เมื่อต้องการรีเซ็ตระบบ

#### ดูข้อมูลระบบ:
```
/เตะใหม่ ข้อมูล
```
จะแสดงวิธีการทำงานของระบบ

### 4. คำสั่งทดสอบ (สำหรับผู้พัฒนา)

#### จำลองสมาชิกใหม่:
```
/ทดสอบเตะ เพิ่ม @user
```

#### ตั้งเวลาเหลือ:
```
/ทดสอบเตะ เวลา @user 1
```
ตั้งให้เหลือเวลา 1 นาที

#### ตรวจสอบทันที:
```
/ทดสอบเตะ ตรวจ
```
ตรวจสอบและเตะสมาชิกหมดเวลาทันที

## การแก้ไขปัญหา

### หากไม่ทำงาน:
1. ตรวจสอบว่าบอทเป็นแอดมินของกลุ่ม
2. ตรวจสอบล็อกข้อผิดพลาด
3. ลองรีสตาร์ทบอท

### หากต้องการปิดระบบ:
1. ลบไฟล์ `modules/events/newMemberMonitor.js`
2. หรือรีเนมไฟล์เป็น `.js.bak`

## หมายเหตุ
- ระบบจะไม่เตะแอดมินหรือบอท
- ข้อมูลจะถูกบันทึกอัตโนมัติ
- รองรับการรีสตาร์ทโดยไม่สูญหายข้อมูล
