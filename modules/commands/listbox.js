module.exports = {
  name: 'รายชื่อกลุ่ม',
  description: 'แสดงข้อมูลกลุ่มทั้งหมด',
  usage: '[nashPrefix]รายชื่อกลุ่ม',
  nashPrefix: false,
  aliases: ['listbox', 'กลุ่ม'],
  execute: async (api, event, args, prefix) => {
    try {
      const inbox = await api.getThreadList(100, null, ['INBOX']);
      const list = inbox.filter(group => group.isSubscribed && group.isGroup);

      const listthread = [];
      for (const groupInfo of list) {
        const data = await api.getThreadInfo(groupInfo.threadID);
        listthread.push({
          id: groupInfo.threadID,
          name: groupInfo.name,
          sotv: data.userInfo.length,
        });
      }

      const listbox = listthread.sort((a, b) => b.sotv - a.sotv);

      let msg = '';
      listbox.forEach((group, i) => {
        msg += `${i + 1}. ${group.name}\n🧩รหัสกลุ่ม: ${group.id}\n🐸สมาชิก: ${group.sotv} คน\n\n`;
      });

      await api.sendMessage(msg, event.threadID, event.messageID);
    } catch (error) {
      console.error('Error in listbox command:', error);
      await api.sendMessage('เกิดข้อผิดพลาดในการประมวลผลคำสั่ง', event.threadID);
    }
  }
};