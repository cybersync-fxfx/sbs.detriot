const fs = require('fs');
let text = fs.readFileSync('frontend/index.html', 'utf-8');
text = text.replace(/\\`/g, '`');
fs.writeFileSync('frontend/index.html', text);
console.log('Fixed backticks');
