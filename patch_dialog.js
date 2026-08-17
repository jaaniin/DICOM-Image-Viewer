const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

code = code.replace(
  '<p className="text-sm text-neutral-400">The Patient ID of the new images differs from the previously loaded ones.</p>',
  '<p className="text-sm text-neutral-400">The new images have a different Patient ID than the currently loaded images.</p>'
);

code = code.replace(
  '<span>Add images even if IDs differ</span>',
  '<span>Append Anyway</span>'
);

code = code.replace(
  '<span>Remove previous and add new images</span>',
  '<span>Replace Images</span>'
);

fs.writeFileSync('app/page.tsx', code);
console.log("Dialog text patched");
