module.exports = {
  name: 'เว็บช่วยเหลือ',
  description: 'คู่มือการใช้งานระบบรันเว็บไซต์',
  usage: '[nashPrefix]เว็บช่วยเหลือ',
  nashPrefix: true,
  aliases: ['webhelp', 'webhowto'],
  execute: async (api, event, args, prefix) => {
    const { threadID, messageID } = event;

    const helpMessage = `🌐 คู่มือระบบรันเว็บไซต์
═══════════════════════════

📋 คำสั่งทั้งหมด:
────────────────────
🚀 ${prefix}รันเว็บ [pastebin_url]
   └ รันเว็บไซต์จาก HTML ใน Pastebin

📊 ${prefix}เว็บสถานะ
   └ ตรวจสอบสถานะเซิร์ฟเวอร์

⏹️ ${prefix}หยุดเว็บ
   └ หยุดเซิร์ฟเวอร์เว็บ

❓ ${prefix}เว็บช่วยเหลือ
   └ แสดงคู่มือนี้

📝 วิธีการใช้งาน:
────────────────────
1️⃣ เตรียม HTML Code
   • สร้างไฟล์ HTML
   • อัพโหลดไปที่ pastebin.com
   • คัดลอกลิงก์

2️⃣ รันเว็บไซต์
   • ใช้คำสั่ง: ${prefix}รันเว็บ [pastebin_url]
   • รอการประมวลผล
   • จะได้ URL และภาพตัวอย่าง

3️⃣ เข้าชมเว็บไซต์
   • เปิด http://localhost:6666
   • เว็บไซต์จะทำงาน 24 ชั่วโมง

⚙️ คุณสมบัติ:
────────────────────
✅ รันได้ทันที
✅ ภาพตัวอย่างอัตโนมัติ
✅ อายุ 24 ชั่วโมง
✅ หยุดอัตโนมัติ
✅ รองรับ HTML, CSS, JavaScript

📌 ตัวอย่าง HTML ง่ายๆ:
────────────────────
\`\`\`html
<!DOCTYPE html>
<html>
<head>
    <title>My Website</title>
</head>
<body>
    <h1>Hello World!</h1>
    <p>This is my website</p>
</body>
</html>
\`\`\`

⚠️ ข้อควรระวัง:
────────────────────
• ใช้เฉพาะลิงก์ Pastebin
• เซิร์ฟเวอร์หยุดหลัง 24 ชั่วโมง
• พอร์ต 6666 เท่านั้น
• ไม่รองรับ server-side code

🎯 Tips:
────────────────────
• ใช้ CSS สำหรับการตกแต่ง
• ใส่ JavaScript สำหรับความน่าสนใจ
• ทดสอบ HTML ก่อนอัพโหลด
• เก็บ backup ไฟล์ HTML

💡 หากมีปัญหา:
────────────────────
1. ตรวจสอบลิงก์ Pastebin
2. ดู ${prefix}เว็บสถานะ
3. ลอง ${prefix}หยุดเว็บ แล้วรันใหม่

🤖 Bot Web System v1.0`;

    await api.sendMessage(helpMessage, threadID, messageID);
  }
};
