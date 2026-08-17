const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

code = code.replace(
  '<h2 className="text-lg font-bold text-white">Potilas-ID ei täsmää</h2>',
  '<h2 className="text-lg font-bold text-white">Patient ID Mismatch</h2>'
);

code = code.replace(
  '<p className="text-sm text-neutral-400">Uusien kuvien Patient ID eroaa aiemmin ladatuista.</p>',
  '<p className="text-sm text-neutral-400">The Patient ID of the new images differs from the previously loaded ones.</p>'
);

code = code.replace(
  '<span>Lisää kuvat vaikka ID:t poikkeavat</span>',
  '<span>Add images even if IDs differ</span>'
);

code = code.replace(
  '<span>Poista aiemmat ja lisää uudet kuvat</span>',
  '<span>Remove previous and add new images</span>'
);

code = code.replace(
  '>                Peru              </button>',
  '>                Cancel              </button>'
);

fs.writeFileSync('app/page.tsx', code);
console.log("Language patched");
