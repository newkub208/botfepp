const axios = require("axios");
// [FIXED] เปลี่ยนวิธีการ import เพื่อให้รองรับ jimp ได้ทุกเวอร์ชัน
const { Jimp } = require("jimp"); 
const QrCode = require("qrcode-reader");

module.exports = {
  name: "อ่านคิวอาร์",
  description: "อ่านข้อมูลจาก QR Code ในรูปภาพโดยการตอบกลับ (รองรับ PromptPay, Wallet, ธนาคาร, WiFi, URL)",
  version: "2.4.0", // อัปเดตเวอร์ชัน - เพิ่มการรองรับ Wallet และปรับปรุงการประมวลผลภาพ
  aliases: ["readqr", "qrscan", "อ่านqr"],
  nashPrefix: false,
  cooldowns: 5,

  async execute(api, event, args, prefix) {
    const { threadID, messageID, type, messageReply } = event;

    // --- 1. ตรวจสอบว่าเป็นการตอบกลับข้อความหรือไม่ ---
    if (type !== "message_reply") {
      return api.sendMessage(
        "กรุณาตอบกลับรูป QR Code แล้วใช้คำสั่งนี้อีกครั้ง",
        threadID,
        messageID
      );
    }

    // --- 2. ตรวจสอบว่าข้อความที่ตอบกลับมีไฟล์แนบหรือไม่ ---
    if (!messageReply || !messageReply.attachments || messageReply.attachments.length === 0) {
      return api.sendMessage(
        "ไม่พบไฟล์แนบ กรุณาตอบกลับรูป QR Code",
        threadID,
        messageID
      );
    }

    // --- 3. ค้นหาไฟล์แนบที่เป็นรูปภาพ ---
    const imageAttachment = messageReply.attachments.find(att => att.type === "photo");

    if (!imageAttachment) {
      return api.sendMessage(
        "ไฟล์แนบไม่ใช่รูปภาพ กรุณาลองใหม่",
        threadID,
        messageID
      );
    }

    const imageUrl = imageAttachment.url;
    const waitingMessage = await api.sendMessage("🔍 กำลังอ่าน QR Code...", threadID);

    try {
      // --- 4. ดาวน์โหลดรูปภาพมาเป็น Buffer ---
      const imageBuffer = (await axios.get(imageUrl, { responseType: 'arraybuffer' })).data;
      
      // --- 5. [ENHANCED] ปรับปรุงการประมวลผลภาพเพื่อให้อ่าน QR Code ได้ดีขึ้น ---
      let image = await Jimp.read(imageBuffer);
      
      // ปรับแต่งภาพเพื่อให้อ่าน QR Code ได้ดีขึ้น
      image = image
        .greyscale() // แปลงเป็นขาวดำ
        .contrast(0.5) // เพิ่ม contrast
        .normalize(); // ปรับความสว่าง
      
      // หากภาพเล็กเกินไป ให้ขยายขนาด
      if (image.bitmap.width < 300 || image.bitmap.height < 300) {
        image = image.resize(600, 600);
      }

      const qr = new QrCode();

      // ลองอ่าน QR Code หลายครั้งด้วยการปรับแต่งภาพต่างๆ
      let decodedText = null;
      const attempts = [
        image, // ภาพที่ปรับแต่งแล้ว
        image.clone().brightness(0.2), // เพิ่มความสว่าง
        image.clone().brightness(-0.2), // ลดความสว่าง
        image.clone().contrast(0.8), // เพิ่ม contrast มากขึ้น
        image.clone().invert(), // กลับสี (ขาวดำ)
        image.clone().blur(1).contrast(1.0), // เบลอเล็กน้อยแล้วเพิ่ม contrast
        image.clone().resize(800, 800), // ขยายขนาดมากขึ้น
        image.clone().threshold({ max: 200, replace: 255, autoGreyscale: false }), // threshold สำหรับ QR Code ที่มีสีซ่อน
        image.clone().posterize(2) // ลดจำนวนสีเหลือ 2 สี (ขาวดำ)
      ];

      for (let i = 0; i < attempts.length; i++) {
        try {
          decodedText = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error("Timeout"));
            }, 5000); // เพิ่ม timeout เป็น 5 วินาที

            qr.callback = (err, value) => {
              clearTimeout(timeout);
              if (err || !value) {
                reject(new Error("Cannot decode"));
              } else {
                resolve(value.result);
              }
            };
            qr.decode(attempts[i].bitmap);
          });
          console.log(`✅ QR Code อ่านสำเร็จในครั้งที่ ${i + 1}`);
          break; // หากสำเร็จ ให้หยุดลูป
        } catch (err) {
          console.log(`❌ ครั้งที่ ${i + 1} ไม่สำเร็จ: ${err.message}`);
          if (i === attempts.length - 1) {
            throw new Error("ไม่พบ QR Code ในรูปภาพ หรืออ่านไม่ได้");
          }
          continue; // ลองครั้งต่อไป
        }
      }

      // --- 6. ส่งผลลัพธ์ที่อ่านได้พร้อมการจัดรูปแบบข้อมูล ---
      let formattedResult = decodedText;
      
      // ตรวจสอบและจัดรูปแบบสำหรับ QR Code ประเภทต่างๆ
      if (decodedText.includes("promptpay") || decodedText.includes("00020101")) {
        formattedResult = `💰 **PromptPay QR Code**\n\n📱 ${decodedText}`;
      } else if (decodedText.includes("truemoney") || decodedText.includes("tmn://") || decodedText.includes("truewallet")) {
        formattedResult = `💙 **TrueMoney Wallet**\n\n📱 ${decodedText}`;
      } else if (decodedText.includes("shopeepay") || decodedText.includes("spay://") || decodedText.toLowerCase().includes("shopee")) {
        formattedResult = `🧡 **ShopeePay**\n\n📱 ${decodedText}`;
      } else if (decodedText.includes("rabbit") || decodedText.includes("rabbitlinepay") || decodedText.includes("linepay")) {
        formattedResult = `🐰 **Rabbit LINE Pay**\n\n📱 ${decodedText}`;
      } else if (decodedText.includes("scb") || decodedText.includes("scbeasy") || decodedText.toLowerCase().includes("siam")) {
        formattedResult = `💜 **SCB Easy**\n\n📱 ${decodedText}`;
      } else if (decodedText.includes("kplus") || decodedText.includes("kasikorn") || decodedText.includes("kbank")) {
        formattedResult = `💚 **K PLUS**\n\n📱 ${decodedText}`;
      } else if (decodedText.includes("bbl") || decodedText.includes("bangkok") || decodedText.includes("bualuang")) {
        formattedResult = `🔵 **Bualuang mBanking**\n\n📱 ${decodedText}`;
      } else if (decodedText.includes("ktb") || decodedText.includes("krungthai") || decodedText.includes("next")) {
        formattedResult = `🟡 **Krungthai NEXT**\n\n📱 ${decodedText}`;
      } else if (decodedText.includes("paotang") || decodedText.includes("เป๋าตัง") || decodedText.includes("paotung")) {
        formattedResult = `🏛️ **เป๋าตัง**\n\n📱 ${decodedText}`;
      } else if (decodedText.includes("wallet") || decodedText.includes("pay://") || decodedText.includes("payment")) {
        formattedResult = `💳 **Digital Wallet**\n\n📱 ${decodedText}`;
      } else if (decodedText.startsWith("http") || decodedText.startsWith("https")) {
        formattedResult = `🌐 **Website**\n\n🔗 ${decodedText}`;
      } else if (decodedText.includes("wifi:") || decodedText.includes("WIFI:")) {
        formattedResult = `📶 **WiFi**\n\n📡 ${decodedText}`;
      } else if (decodedText.includes("tel:") || /^\+?\d{10,}$/.test(decodedText)) {
        formattedResult = `📞 **เบอร์โทร**\n\n☎️ ${decodedText.replace("tel:", "")}`;
      } else if (decodedText.includes("@")) {
        formattedResult = `📧 **อีเมล**\n\n✉️ ${decodedText}`;
      } else if (/^\d+$/.test(decodedText) && decodedText.length >= 10) {
        formattedResult = `🔢 **หมายเลข/รหัส**\n\n🆔 ${decodedText}`;
      }

      api.sendMessage(
        `✅ อ่าน QR Code ได้:\n\n${formattedResult}`,
        threadID,
        messageID
      );

    } catch (err) {
      console.error("❌ QR Code Reader Error:", err.message);
      api.sendMessage(`❌ ${err.message}`, threadID, messageID);
    } finally {
        api.unsendMessage(waitingMessage.messageID);
    }
  }
};

