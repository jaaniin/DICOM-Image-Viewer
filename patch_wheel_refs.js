const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

code = code.replace(
  'const fileInputRef = useRef<HTMLInputElement>(null);',
  `const fileInputRef = useRef<HTMLInputElement>(null);\n  const wheelTimeRef = useRef<number>(0);\n  const wheelStreakRef = useRef<number>(0);`
);

fs.writeFileSync('app/page.tsx', code);
console.log("Wheel refs added");
