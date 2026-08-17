const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

code = code.replace(/Peru(\s*<\/button>)/, 'Cancel$1');

fs.writeFileSync('app/page.tsx', code);
console.log("Peru patched with regex");
