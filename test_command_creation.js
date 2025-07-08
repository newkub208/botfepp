// Test script to verify command creation system
const fs = require('fs');
const path = require('path');

// Simulate the command creation
async function testCommandCreation() {
  console.log('🚀 Testing user command creation system...\n');
  
  const CUSTOM_COMMANDS_DIR = path.join(__dirname, 'modules', 'commands', 'user_commands');
  const CUSTOM_COMMANDS_FILE = path.join(__dirname, 'modules', 'commands', 'customCommands.json');
  
  // Test 1: Check if folder exists
  console.log('📁 Checking user_commands folder...');
  if (fs.existsSync(CUSTOM_COMMANDS_DIR)) {
    console.log('✅ user_commands folder exists');
  } else {
    console.log('❌ user_commands folder does not exist');
    return;
  }
  
  // Test 2: Create a test command
  console.log('\n📝 Creating test command...');
  const commandName = 'ทดสอบระบบ';
  const commandDescription = 'คำสั่งทดสอบระบบ';
  const senderID = 'test123';
  const threadID = 'thread123';
  const expiredAt = Date.now() + (24 * 60 * 60 * 1000); // 1 day from now
  
  try {
    // Create command file
    const commandContent = `// Auto-generated user command: ${commandName}
// Created by: ${senderID}
// Expires: ${new Date(expiredAt).toLocaleString('th-TH')}

module.exports = {
  name: '${commandName}',
  description: '${commandDescription}',
  nashPrefix: false,
  execute: async (api, event, args, prefix) => {
    try {
      // Check if command is expired
      const expiredAt = ${expiredAt};
      if (Date.now() > expiredAt) {
        return api.sendMessage(
          '❌ คำสั่งนี้หมดอายุแล้ว',
          event.threadID,
          event.messageID
        );
      }
      
      // Simple response for testing
      const response = 'สวัสดี! นี่คือคำสั่งทดสอบระบบ ✅';
      
      return api.sendMessage(
        response,
        event.threadID,
        event.messageID
      );
      
    } catch (error) {
      console.error('Error in user command ${commandName}:', error);
      return api.sendMessage(
        '❌ เกิดข้อผิดพลาดในการประมวลผลคำสั่ง',
        event.threadID,
        event.messageID
      );
    }
  }
};`;
    
    const filePath = path.join(CUSTOM_COMMANDS_DIR, `${commandName}.js`);
    fs.writeFileSync(filePath, commandContent, 'utf8');
    console.log('✅ Command file created successfully');
    
    // Update customCommands.json
    let customCommands = {};
    if (fs.existsSync(CUSTOM_COMMANDS_FILE)) {
      const data = fs.readFileSync(CUSTOM_COMMANDS_FILE, 'utf8');
      try {
        customCommands = JSON.parse(data);
      } catch (e) {
        console.log('Creating new customCommands.json file');
      }
    }
    
    customCommands[commandName] = {
      name: commandName,
      description: commandDescription,
      createdBy: senderID,
      createdAt: Date.now(),
      expiredAt: expiredAt,
      threadID: threadID
    };
    
    fs.writeFileSync(CUSTOM_COMMANDS_FILE, JSON.stringify(customCommands, null, 2), 'utf8');
    console.log('✅ Command metadata saved successfully');
    
    // Test 3: Verify file was created and can be loaded
    console.log('\n🔍 Verifying command file...');
    if (fs.existsSync(filePath)) {
      console.log('✅ Command file exists');
      
      // Try to require the file
      try {
        delete require.cache[require.resolve(filePath)];
        const commandModule = require(filePath);
        console.log('✅ Command file can be loaded');
        console.log('📋 Command details:', {
          name: commandModule.name,
          description: commandModule.description,
          hasExecute: typeof commandModule.execute === 'function'
        });
      } catch (error) {
        console.log('❌ Error loading command file:', error.message);
      }
    } else {
      console.log('❌ Command file was not created');
    }
    
    // Test 4: Clean up
    console.log('\n🧹 Cleaning up test files...');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('✅ Test command file deleted');
    }
    
    // Remove from customCommands.json
    delete customCommands[commandName];
    fs.writeFileSync(CUSTOM_COMMANDS_FILE, JSON.stringify(customCommands, null, 2), 'utf8');
    console.log('✅ Test command metadata removed');
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCommandCreation();
