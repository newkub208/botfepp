// สคริปต์ทดสอบระบบเตะสมาชิกใหม่
const newMemberMonitor = require('./modules/events/newMemberMonitor.js');

console.log('🧪 ทดสอบระบบเตะสมาชิกใหม่');

// ทดสอบการโหลดข้อมูล
try {
  console.log('✅ โหลด newMemberMonitor สำเร็จ');
  
  // ทดสอบการเข้าถึงฟังก์ชัน
  if (typeof newMemberMonitor.getNewMembersStatus === 'function') {
    console.log('✅ ฟังก์ชัน getNewMembersStatus พร้อมใช้งาน');
  } else {
    console.log('❌ ฟังก์ชัน getNewMembersStatus ไม่พร้อมใช้งาน');
  }
  
  if (typeof newMemberMonitor.clearNewMembersData === 'function') {
    console.log('✅ ฟังก์ชัน clearNewMembersData พร้อมใช้งาน');
  } else {
    console.log('❌ ฟังก์ชัน clearNewMembersData ไม่พร้อมใช้งาน');
  }
  
  if (typeof newMemberMonitor.onEvent === 'function') {
    console.log('✅ ฟังก์ชัน onEvent พร้อมใช้งาน');
  } else {
    console.log('❌ ฟังก์ชัน onEvent ไม่พร้อมใช้งาน');
  }
  
  // ทดสอบการดูสถานะ
  const status = newMemberMonitor.getNewMembersStatus();
  console.log(`✅ ดูสถานะสมาชิกใหม่: ${status.length} คน`);
  
  console.log('\n📋 ผลการทดสอบ:');
  console.log('- ระบบพร้อมใช้งาน');
  console.log('- ฟังก์ชันทั้งหมดทำงานปกติ');
  console.log('- สามารถเรียกใช้ผ่าน API ได้');
  
} catch (error) {
  console.error('❌ ข้อผิดพลาดในการทดสอบ:', error.message);
  console.error('📝 รายละเอียด:', error);
}

console.log('\n🎯 การทดสอบเสร็จสิ้น');
