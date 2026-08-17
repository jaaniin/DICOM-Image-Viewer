const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

code = code.replace(
  'Poista valitut {selectedForDeletion.size > 0 ? `(${selectedForDeletion.size})` : \'\'}',
  'Delete selected {selectedForDeletion.size > 0 ? `(${selectedForDeletion.size})` : \'\'}'
);

fs.writeFileSync('app/page.tsx', code);
console.log("Delete selected patched");
