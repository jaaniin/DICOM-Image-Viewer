const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

const oldDialog = `
            <div className="p-5 flex flex-col gap-3">
              <button
                onClick={() => handleConfirmMismatchDialog(false)}
                className="w-full px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors flex items-center justify-between"
              >
                <span>Append Anyway</span>
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </button>
              <button
                onClick={() => handleConfirmMismatchDialog(true)}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow transition-colors flex items-center justify-between"
              >
                <span>Replace Images</span>
                <ChevronRight className="w-4 h-4 text-blue-200" />
              </button>
`;

const newDialog = `
            <div className="p-5 flex flex-col gap-3">
              <button
                onClick={() => handleConfirmMismatchDialog(true)}
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow transition-colors flex items-center justify-between"
              >
                <span>Replace Images</span>
                <ChevronRight className="w-4 h-4 text-blue-200" />
              </button>
              <button
                onClick={() => handleConfirmMismatchDialog(false)}
                className="w-full px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors flex items-center justify-between"
              >
                <span>Append Anyway</span>
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </button>
`;

code = code.replace(oldDialog.trim(), newDialog.trim());
fs.writeFileSync('app/page.tsx', code);
console.log("Dialog order patched");
