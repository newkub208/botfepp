/**
 * ตัวอย่างการใช้งานระบบคำสั่งแบบกำหนดเองใน index.js หรือไฟล์หลัก
 * 
 * วิธีการรวมฟังก์ชันการประมวลผลคำสั่งที่ผู้ใช้สร้างเข้ากับระบบบอท
 * คำสั่งที่สร้างจะเป็นไฟล์ .js แยกในโฟลเดอร์ user_commands/
 */

// Import คำสั่งสร้างคำสั่ง
const customCommandHandler = require('./modules/commands/สร้างคำสั่ง');

// ฟังก์ชันจัดการข้อความ (ใส่ใน event handler หลัก)
async function handleMessage(api, event) {
  const { body } = event;
  
  // ตรวจสอบว่าเป็นคำสั่งที่ผู้ใช้สร้างหรือไม่
  const isCustomCommand = await customCommandHandler.processUserMessage(api, event);
  
  if (isCustomCommand) {
    return; // หยุดการประมวลผลถ้าเป็นคำสั่งที่ผู้ใช้สร้าง
  }
  
  // ต่อด้วยการประมวลผลคำสั่งปกติอื่นๆ
  // ... โค้ดอื่นๆ ของบอท
}

// ตัวอย่างการใช้งานในระบบ event ของ Facebook Bot
module.exports = (api, event) => {
  handleMessage(api, event);
};

// ตัวอย่างการใช้งานฟังก์ชันเสริม
function exampleUsage() {
  
  // ตรวจสอบว่าเป็นคำสั่งที่ผู้ใช้สร้างหรือไม่
  const isCustom = customCommandHandler.isCustomCommand('สวัสดี');
  
  // ดึงข้อมูลคำสั่งที่ผู้ใช้สร้าง (โหลดจากไฟล์ .js)
  const customCmd = customCommandHandler.getCustomCommand('สวัสดี');
  if (customCmd) {
    console.log('คำสั่ง:', customCmd.name);
    console.log('คำอธิบาย:', customCmd.description);
    console.log('สร้างโดย:', customCmd.createdBy);
    console.log('หมดอายุ:', new Date(customCmd.expiredAt));
    
    // เรียกใช้คำสั่งโดยตรง
    // customCmd.execute(api, event, [], '');
  }
  
  // แสดงรายการคำสั่งทั้งหมด
  const allCommands = customCommandHandler.listCustomCommands();
  console.log('คำสั่งที่มีทั้งหมด:', allCommands);
}

/*
วิธีการผสมรวมใน index.js หลัก:

1. Import คำสั่ง:
const customCommandHandler = require('./modules/commands/สร้างคำสั่ง');

2. ใน event handler ของข้อความ เพิ่ม:
const isCustomCommand = await customCommandHandler.processUserMessage(api, event);
if (isCustomCommand) return;

3. การใช้งาน:
- ผู้ใช้พิมพ์: "/สร้างคำสั่ง สวัสดี | ทักทายผู้ใช้อย่างสุภาพ"
- ระบบจะสร้างไฟล์ user_commands/สวัสดี.js
- เมื่อผู้ใช้พิมพ์ "สวัสดี" ระบบจะโหลดและเรียกใช้ไฟล์นั้น

4. โครงสร้างไฟล์ที่สร้างขึ้น (user_commands/สวัสดี.js):
module.exports = {
  name: 'สวัสดี',
  description: 'ทักทายผู้ใช้อย่างสุภาพ',
  nashPrefix: false,
  execute: async (api, event, args, prefix) => {
    // โค้ดการทำงานที่ใช้ AI
    // ตรวจสอบอายุการใช้งาน
    // เรียก AI API
  },
  isCustomCommand: true,
  createdBy: 'userID',
  createdAt: timestamp,
  expiredAt: timestamp,
  threadID: 'threadID'
}

5. โครงสร้างโฟลเดอร์:
modules/commands/
├── สร้างคำสั่ง.js
├── customCommands.json (metadata)
└── user_commands/
    ├── สวัสดี.js
    ├── เล่าเรื่องตลก.js
    └── ...

6. ข้อดี:
- แต่ละคำสั่งเป็นไฟล์แยก เหมือนคำสั่งระบบ
- สามารถแก้ไขไฟล์โดยตรงได้
- การจัดการ cache และ require ทำได้ง่าย
- ดูโครงสร้างไฟล์ได้ชัดเจน

7. คำสั่งเสริม:
- "/สร้างคำสั่ง list" - แสดงรายการคำสั่งที่สร้าง
- "/สร้างคำสั่ง delete <ชื่อคำสั่ง>" - ลบคำสั่งและไฟล์

8. ฟังก์ชันเสริม:
- isCustomCommand(name) - ตรวจสอบว่าเป็นคำสั่งที่ผู้ใช้สร้างหรือไม่
- getCustomCommand(name) - โหลดไฟล์คำสั่งและคืนค่า module
- listCustomCommands() - แสดงรายการคำสั่งทั้งหมด

9. การทำงานของระบบ:
- สร้างโฟลเดอร์ user_commands/ อัตโนมัติ
- เก็บ metadata ใน customCommands.json
- แต่ละคำสั่งเป็นไฟล์ .js ใน user_commands/
- ลบไฟล์อัตโนมัติเมื่อหมดอายุ
- ตรวจสอบการมีอยู่ของไฟล์ก่อนเรียกใช้
*/
