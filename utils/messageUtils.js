const fs = require("fs");

/**
 * ส่งข้อความพร้อมไฟล์แนบอย่างปลอดภัย
 * @param {object} api - Facebook API object
 * @param {string|object} message - ข้อความที่จะส่ง หรือ object ที่มี body และ attachment
 * @param {string} threadID - ID ของเธรด
 * @param {string} messageID - ID ของข้อความที่ตอบกลับ (optional)
 * @param {string} filePath - path ของไฟล์ที่จะแนบ (optional)
 * @returns {Promise} Promise ที่ resolve เมื่อส่งข้อความสำเร็จ
 */
async function sendMessageWithAttachment(api, message, threadID, messageID = null, filePath = null) {
  try {
    // ถ้าเป็น string ธรรมดา
    if (typeof message === 'string') {
      if (filePath && fs.existsSync(filePath)) {
        // ตรวจสอบว่าไฟล์อ่านได้จริง
        if (!isFileReadable(filePath)) {
          console.warn(`[WARN] File not readable: ${filePath}, sending text only`);
          return await api.sendMessage(message, threadID, messageID);
        }
        
        const attachment = createSafeReadStream(filePath);
        if (attachment) {
          // สร้าง message object ที่ปลอดภัย - ใช้ single attachment แทน array
          const messageObj = {
            body: message,
            attachment: attachment
          };
          
          // ทำความสะอาด object ก่อนส่ง
          const cleanedMessage = sanitizeMessageObject(messageObj);
          return await api.sendMessage(cleanedMessage, threadID, messageID);
        } else {
          console.warn(`[WARN] Failed to create ReadStream for ${filePath}, sending text only`);
          return await api.sendMessage(message, threadID, messageID);
        }
      } else {
        return await api.sendMessage(message, threadID, messageID);
      }
    }
    
    // ถ้าเป็น object ที่มี attachment แล้ว
    if (typeof message === 'object' && message !== null) {
      const cleanedMessage = sanitizeMessageObject(message);
      return await api.sendMessage(cleanedMessage, threadID, messageID);
    }
    
    // ถ้าเป็น object ธรรมดา
    return await api.sendMessage(message, threadID, messageID);
    
  } catch (error) {
    console.error("[ERROR] Failed to send message with attachment:", error);
    
    // ลองส่งแค่ข้อความถ้าส่งไฟล์แนบไม่ได้
    try {
      const fallbackMessage = typeof message === 'string' ? message : (message.body || "ข้อความไม่สามารถแสดงได้");
      return await api.sendMessage(fallbackMessage, threadID, messageID);
    } catch (fallbackError) {
      console.error("[ERROR] Failed to send fallback message:", fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * ตรวจสอบว่าไฟล์มีอยู่จริงและสามารถอ่านได้
 * @param {string} filePath - path ของไฟล์
 * @returns {boolean} true ถ้าไฟล์มีอยู่และอ่านได้
 */
function isFileReadable(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

/**
 * สร้าง ReadStream อย่างปลอดภัย
 * @param {string} filePath - path ของไฟล์
 * @returns {ReadStream|null} ReadStream หรือ null ถ้าไม่สามารถสร้างได้
 */
function createSafeReadStream(filePath) {
  try {
    if (isFileReadable(filePath)) {
      return fs.createReadStream(filePath);
    }
    return null;
  } catch (error) {
    console.error(`[ERROR] Failed to create ReadStream for ${filePath}:`, error);
    return null;
  }
}

/**
 * ทำความสะอาด message object ให้ปลอดภัยสำหรับ ws3-fca
 * @param {object} messageObj - message object ที่อาจมี attachment
 * @returns {object} message object ที่ทำความสะอาดแล้ว
 */
function sanitizeMessageObject(messageObj) {
  if (!messageObj || typeof messageObj !== 'object') {
    return messageObj;
  }

  const cleaned = {};
  
  // คัดลอกเฉพาะ properties ที่จำเป็นและไม่เป็น null/undefined
  Object.keys(messageObj).forEach(key => {
    const value = messageObj[key];
    
    if (value != null) {
      if (key === 'attachment') {
        // จัดการ attachment เป็นพิเศษ
        if (Array.isArray(value)) {
          const validAttachments = value.filter(att => att != null);
          if (validAttachments.length > 0) {
            cleaned[key] = validAttachments;
          }
        } else if (typeof value === 'object' || typeof value === 'string') {
          cleaned[key] = value;
        }
      } else {
        cleaned[key] = value;
      }
    }
  });

  return cleaned;
}

/**
 * ทำความสะอาด attachment object ให้ปลอดภัย (เก่า - เก็บไว้เพื่อ backward compatibility)
 * @param {object} messageObj - message object ที่อาจมี attachment
 * @returns {object} message object ที่ทำความสะอาดแล้ว
 */
function sanitizeAttachment(messageObj) {
  if (!messageObj || typeof messageObj !== 'object') {
    return messageObj;
  }

  const cleaned = { ...messageObj };

  if (cleaned.attachment) {
    if (Array.isArray(cleaned.attachment)) {
      // กรองสิ่งที่เป็น null, undefined หรือไม่ใช่ object
      cleaned.attachment = cleaned.attachment.filter(att => {
        return att != null && (typeof att === 'object' || typeof att === 'string');
      });
      
      if (cleaned.attachment.length === 0) {
        delete cleaned.attachment;
      }
    } else if (cleaned.attachment == null) {
      delete cleaned.attachment;
    }
  }

  return cleaned;
}

/**
 * ส่งข้อความแบบปลอดภัย (รองรับทั้ง string และ object)
 * @param {object} api - Facebook API object
 * @param {string|object} message - ข้อความที่จะส่ง
 * @param {string} threadID - ID ของเธรด
 * @param {string} messageID - ID ของข้อความที่ตอบกลับ (optional)
 * @returns {Promise} Promise ที่ resolve เมื่อส่งข้อความสำเร็จ
 */
async function safeSendMessage(api, message, threadID, messageID = null) {
  try {
    if (typeof message === 'object' && message !== null) {
      message = sanitizeMessageObject(message);
    }
    
    return await api.sendMessage(message, threadID, messageID);
  } catch (error) {
    console.error("[ERROR] Failed to send message safely:", error);
    
    // Fallback: ส่งเฉพาะข้อความ
    try {
      const fallbackMessage = typeof message === 'string' ? message : (message.body || "ข้อความไม่สามารถแสดงได้");
      return await api.sendMessage(fallbackMessage, threadID, messageID);
    } catch (fallbackError) {
      console.error("[ERROR] Failed to send fallback message:", fallbackError);
      throw fallbackError;
    }
  }
}

module.exports = {
  sendMessageWithAttachment,
  isFileReadable,
  createSafeReadStream,
  sanitizeMessageObject,
  sanitizeAttachment,
  safeSendMessage
};
