/**
 * ตัวอย่างการรองรับ module.exports array format ใหม่
 * 
 * ตอนนี้ระบบสามารถรองรับ AI ที่ส่งโค้ดในรูปแบบ:
 * 1. โค้ด JavaScript ปกติ
 * 2. module.exports = [commands array]
 */

// ตัวอย่างที่ 1: AI ส่ง module.exports array
const example1 = {
  userInput: "/สร้างคำสั่ง ทักทาย | สร้างคำสั่งทักทายผู้ใช้",
  aiResponse: `
module.exports = [
  {
    name: 'hello',
    description: 'คำสั่งส่งข้อความสวัสดี',
    nashPrefix: true,
    execute: async (api, event, args, prefix) => {
      api.sendMessage('สวัสดีครับ/ค่ะ!', event.threadID, event.messageID);
    }
  }
];
  `,
  result: "ระบบจะแยก command แรกออกมาและเรียกใช้ execute function"
};

// ตัวอย่างที่ 2: AI ส่ง array หลาย commands
const example2 = {
  userInput: "/สร้างคำสั่ง เกม | สร้างเกมง่ายๆ",
  aiResponse: `
module.exports = [
  {
    name: 'dice',
    description: 'ทอยลูกเต๋า',
    nashPrefix: false,
    execute: async (api, event) => {
      const result = Math.floor(Math.random() * 6) + 1;
      api.sendMessage(\`🎲 ลูกเต๋า: \${result}\`, event.threadID);
    }
  },
  {
    name: 'coin',
    description: 'โยนเหรียญ',
    nashPrefix: false,
    execute: async (api, event) => {
      const result = Math.random() > 0.5 ? 'หัว' : 'ก้อย';
      api.sendMessage(\`🪙 เหรียญ: \${result}\`, event.threadID);
    }
  }
];
  `,
  result: "ระบบจะเรียกใช้ command แรก (dice) เท่านั้น"
};

// ตัวอย่างที่ 3: AI ส่งโค้ดปกติ (เหมือนเดิม)
const example3 = {
  userInput: "/สร้างคำสั่ง เวลา | แสดงเวลาปัจจุบัน",
  aiResponse: `
\`\`\`javascript
const now = new Date();
const timeString = now.toLocaleString('th-TH', {
  timeZone: 'Asia/Bangkok'
});
api.sendMessage(\`⏰ เวลาปัจจุบัน: \${timeString}\`, event.threadID);
\`\`\`
  `,
  result: "ระบบจะรันโค้ดปกติเหมือนเดิม"
};

// การทำงานของระบบ
const systemFlow = {
  step1: "ได้รับ response จาก AI",
  step2: "ตรวจสอบรูปแบบ module.exports array ก่อน",
  step3a: "ถ้าเป็น array → แยก command แรกและเรียกใช้",
  step3b: "ถ้าไม่ใช่ → ตรวจสอบว่าเป็นโค้ด JavaScript ปกติ",
  step4a: "ถ้าเป็นโค้ด → รันโค้ด",
  step4b: "ถ้าไม่ใช่ → แสดงข้อความปกติ"
};

// ฟีเจอร์ความปลอดภัยสำหรับ array format
const securityFeatures = {
  arrayValidation: "ตรวจสอบว่าเป็น Array จริง",
  commandValidation: "ตรวจสอบว่ามี execute function",
  firstCommandOnly: "เรียกใช้เฉพาะ command แรกเพื่อความปลอดภัย",
  errorHandling: "จัดการ error ในการ parse และ execute"
};

// ตัวอย่างการใช้งานจริง
const usageExamples = [
  {
    prompt: "สร้างคำสั่งทักทาย",
    expectedAiResponse: "module.exports = [{ name: 'hello', execute: ... }]",
    systemAction: "รันคำสั่ง hello"
  },
  {
    prompt: "สร้างเกมทายเลข",
    expectedAiResponse: "module.exports = [{ name: 'guess', execute: ... }]",
    systemAction: "รันเกมทายเลข"
  },
  {
    prompt: "คำนวณเลขสุ่ม",
    expectedAiResponse: "```javascript Math.random() ...```",
    systemAction: "รันโค้ดคำนวณ"
  }
];

module.exports = {
  example1,
  example2,
  example3,
  systemFlow,
  securityFeatures,
  usageExamples
};
