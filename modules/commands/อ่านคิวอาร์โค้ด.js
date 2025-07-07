const axios = require("axios");
// [FIXED] เปลี่ยนวิธีการ import เพื่อให้รองรับ jimp ได้ทุกเวอร์ชัน
const jimp = require("jimp"); 
const QrCode = require("qrcode-reader");

module.exports = {
  name: "อ่านคิวอาร์",
  description: "อ่านข้อมูลจาก QR Code ในรูปภาพโดยการตอบกลับ",
  version: "2.2.0", // อัปเดตเวอร์ชัน
  aliases: ["readqr", "qrscan", "อ่านqr"],
  nashPrefix: false,
  cooldowns: 5,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, type, messageReply } = event;

    // --- 1. ตรวจสอบว่าเป็นการตอบกลับข้อความหรือไม่ ---
    if (type !== "message_reply") {
      return api.sendMessage(
        "กรุณาตอบกลับ (reply) รูปภาพ QR Code ที่คุณต้องการอ่าน แล้วใช้คำสั่งนี้อีกครั้งครับ",
        threadID,
        messageID
      );
    }

    // --- 2. ตรวจสอบว่าข้อความที่ตอบกลับมีไฟล์แนบหรือไม่ ---
    if (!messageReply || !messageReply.attachments || messageReply.attachments.length === 0) {
      return api.sendMessage(
        "ไม่พบไฟล์แนบในข้อความที่คุณตอบกลับ กรุณาตอบกลับรูปภาพ QR Code ครับ",
        threadID,
        messageID
      );
    }

    // --- 3. ค้นหาไฟล์แนบที่เป็นรูปภาพ ---
    const imageAttachment = messageReply.attachments.find(att => att.type === "photo");

    if (!imageAttachment) {
      return api.sendMessage(
        "ไฟล์แนบที่คุณตอบกลับไม่ใช่รูปภาพ กรุณาลองใหม่ครับ",
        threadID,
        messageID
      );
    }

    const imageUrl = imageAttachment.url;
    const waitingMessage = await api.sendMessage("กำลังอ่านข้อมูลจาก QR Code โปรดรอสักครู่...", threadID);

    try {
      // --- 4. ดาวน์โหลดรูปภาพมาเป็น Buffer ---
      const imageBuffer = (await axios.get(imageUrl, { responseType: 'arraybuffer' })).data;
      
      // --- 5. [FIXED] ใช้ Jimp ในรูปแบบที่รองรับเวอร์ชันใหม่และเก่า ---
      const image = await jimp.read(imageBuffer);
      const qr = new QrCode();

      // สร้าง Promise เพื่อรอผลลัพธ์จาก callback ของ qrcode-reader
      const decodedText = await new Promise((resolve, reject) => {
        qr.callback = (err, value) => {
          if (err || !value) {
            // ถ้าเกิด error หรือไม่พบข้อมูล ให้ reject promise
            reject(new Error("ไม่พบ QR Code ในรูปภาพ หรือไม่สามารถอ่านข้อมูลได้"));
          } else {
            // ถ้าสำเร็จ ให้ resolve promise พร้อมกับข้อมูลที่อ่านได้
            resolve(value.result);
          }
        };
        qr.decode(image.bitmap);
      });

      // --- 6. ส่งผลลัพธ์ที่อ่านได้ ---
      api.sendMessage(
        `✅ อ่านข้อมูลจาก QR Code ได้:\n\n${decodedText}`,
        threadID,
        messageID
      );

    } catch (err) {
      console.error("❌ QR Code Reader Error:", err.message);
      api.sendMessage(`❌ เกิดข้อผิดพลาดในการอ่าน QR Code: ${err.message}`, threadID, messageID);
    } finally {
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};

