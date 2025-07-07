// Test the regex patterns specifically

const mockResponse = `
// package.json
{
  "name": "discord-music-bot",
  "version": "1.0.0"
}

// index.js
const { Client } = require('discord.js');
console.log('Bot ready!');
`;

console.log('🧪 Testing regex patterns...\n');

// Test Pattern 4: แยกตาม comment ธรรมดา
const pattern = /\/\/\s*([^\n]+)\n```[\w]*\s*\n([\s\S]*?)\n```/g;
const simplePattern = /\/\/\s*([^\n]+)\n([\s\S]*?)(?=\/\/|$)/g;

console.log('Testing Pattern 4 (current):');
let match;
while ((match = pattern.exec(mockResponse)) !== null) {
  console.log('Found match:', match[1], 'Content length:', match[2].length);
}

console.log('\nTesting Simple Pattern (new):');
let match2;
while ((match2 = simplePattern.exec(mockResponse)) !== null) {
  const fileName = match2[1].trim();
  let content = match2[2].trim();
  
  // Clean up content - remove leading/trailing whitespace and newlines
  content = content.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');
  
  console.log('Found:', fileName);
  console.log('Content preview:', content.substring(0, 100) + '...');
}
