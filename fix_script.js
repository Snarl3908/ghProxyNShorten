const fs = require('fs');
const path = require('path');

// 读取文件
const filePath = path.join(__dirname, 'src/index.js');
let content = fs.readFileSync(filePath, 'utf8');

// 替换所有的 checkRateLimit(clientIP, kv) 为 checkRateLimit(clientIP)
content = content.replace(/checkRateLimit\(clientIP, kv\)/g, 'checkRateLimit(clientIP)');

// 写回文件
fs.writeFileSync(filePath, content);

console.log('Successfully fixed checkRateLimit calls in src/index.js');
