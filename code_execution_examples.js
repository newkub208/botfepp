/**
 * ตัวอย่างการใช้งานระบบคำสั่งที่รองรับ JavaScript Code Execution
 * 
 * ตอนนี้ระบบสามารถ:
 * 1. ตรวจสอบว่า AI ส่งโค้ด JavaScript มาหรือไม่
 * 2. รันโค้ดนั้นในสภาพแวดล้อมที่ปลอดภัย
 * 3. แสดงผลลัพธ์ของการรันโค้ด
 */

// ตัวอย่างคำสั่งที่ผู้ใช้อาจสร้าง
const exampleCommands = {
  
  // ตัวอย่าง 1: AI ส่งข้อความธรรมดา
  userInput1: "/สร้างคำสั่ง ทักทาย | ทักทายผู้ใช้อย่างสุภาพ",
  aiResponse1: "สวัสดีครับ! ยินดีที่ได้พบกับคุณ",
  result1: "แสดงข้อความปกติ",
  
  // ตัวอย่าง 2: AI ส่งโค้ด JavaScript
  userInput2: "/สร้างคำสั่ง คำนวณ | สร้างโค้ดคำนวณเลขสุ่ม",
  aiResponse2: `
\`\`\`javascript
const randomNum = Math.floor(Math.random() * 100) + 1;
api.sendMessage(\`🎲 เลขสุ่ม: \${randomNum}\`, event.threadID);
\`\`\`
  `,
  result2: "รันโค้ดและแสดงเลขสุ่ม",
  
  // ตัวอย่าง 3: AI ส่งโค้ดที่ซับซ้อนกว่า
  userInput3: "/สร้างคำสั่ง เวลา | สร้างโค้ดแสดงเวลาปัจจุบัน",
  aiResponse3: `
\`\`\`javascript
const now = new Date();
const timeString = now.toLocaleString('th-TH', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

api.sendMessage(\`🕐 เวลาปัจจุบัน: \${timeString}\`, event.threadID);
console.log('แสดงเวลาแล้ว');
\`\`\`
  `,
  result3: "รันโค้ดแสดงเวลาและ log ข้อความ",
  
  // ตัวอย่าง 4: AI ส่งโค้ดที่มี error handling
  userInput4: "/สร้างคำสั่ง คำนวณเกรด | สร้างโค้ดคำนวณเกรดจากคะแนน",
  aiResponse4: `
\`\`\`javascript
try {
  const score = Math.floor(Math.random() * 100);
  let grade;
  
  if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 60) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';
  
  api.sendMessage(\`📊 คะแนน: \${score} เกรด: \${grade}\`, event.threadID);
  return \`สุ่มเกรดแล้ว: \${grade}\`;
} catch (error) {
  api.sendMessage('❌ เกิดข้อผิดพลาด', event.threadID);
}
\`\`\`
  `,
  result4: "รันโค้ดคำนวณเกรดและคืนค่าผลลัพธ์"
};

// ตัวอย่างฟีเจอร์ความปลอดภัย
const securityFeatures = {
  
  // 1. จำกัด context ที่สามารถเข้าถึงได้
  allowedObjects: [
    'api', 'event', 'console', 'Math', 'Date', 
    'JSON', 'String', 'Number', 'Array', 'Object', 'setTimeout'
  ],
  
  // 2. ห้ามเข้าถึง
  blockedObjects: [
    'require', 'process', 'global', 'Buffer', 
    'fs', 'path', 'os', 'child_process'
  ],
  
  // 3. จำกัดเวลา setTimeout สูงสุด 5 วินาที
  timeoutLimit: 5000,
  
  // 4. Wrap โค้ดในฟังก์ชันเพื่อป้องกัน global pollution
  codeWrapping: true
};

// การทำงานของระบบ
const systemFlow = {
  
  step1: "ผู้ใช้สร้างคำสั่ง",
  step2: "ระบบสร้างไฟล์ .js ในโฟลเดอร์ user_commands/",
  step3: "ผู้ใช้เรียกใช้คำสั่ง",
  step4: "ระบบโหลดไฟล์และเรียก AI",
  step5: "ตรวจสอบว่า AI ส่งโค้ดมาหรือไม่",
  step6a: "ถ้าเป็นข้อความ → แสดงข้อความ",
  step6b: "ถ้าเป็นโค้ด → รันโค้ดในสภาพแวดล้อมปลอดภัย",
  step7: "แสดงผลลัพธ์"
};

module.exports = {
  exampleCommands,
  securityFeatures,
  systemFlow
};
