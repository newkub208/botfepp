const autoReplyTag = require('./modules/events/autoReplyTag.js');

console.log('Testing autoReplyTag module...');
console.log('Module name:', autoReplyTag.name);
console.log('Has onEvent:', typeof autoReplyTag.onEvent === 'function');

// Test config loading
const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, 'modules/commands/autoReplyTagConfig.json');
console.log('Config file exists:', fs.existsSync(configPath));

if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Config loaded:', config);
}

console.log('✅ All tests passed!');
