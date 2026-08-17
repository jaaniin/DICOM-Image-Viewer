const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

const targetUI = `
                      {measurements.map((m, idx) => (
                        <label key={m.id} className="flex items-center gap-2 text-sm text-neutral-200 cursor-pointer hover:bg-neutral-700 p-1.5 rounded transition-colors">
                          <input 
                            type="checkbox" 
                            checked={selectedForDeletion.has(m.id)}
                            onChange={(e) => {
                              const newSet = new Set(selectedForDeletion);
                              if (e.target.checked) newSet.add(m.id);
                              else newSet.delete(m.id);
                              setSelectedForDeletion(newSet);
                            }}
                            className="rounded bg-neutral-900 border-neutral-700 text-red-500 focus:ring-red-500"
                          />
                          <span className="truncate text-xs font-mono">{calculateMeasurementLengthText(m, idx, studies)}</span>
                        </label>
                      ))}
`;

const replacementUI = `
                      {measurements.map((m, idx) => {
                        const isRoi = m.type === 'roi';
                        return (
                        <div key={m.id} className="flex flex-col bg-neutral-900/50 border border-neutral-700/50 rounded overflow-hidden">
                          <div className="flex items-center gap-2 text-sm text-neutral-200 hover:bg-neutral-700 p-1.5 transition-colors cursor-pointer" onClick={(e) => {
                            if ((e.target as HTMLElement).tagName === 'INPUT') return;
                            if (isRoi) setMeasurements(prev => prev.map(old => old.id === m.id ? {...old, isExpanded: !old.isExpanded} : old));
                          }}>
                            <input 
                              type="checkbox" 
                              checked={selectedForDeletion.has(m.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedForDeletion);
                                if (e.target.checked) newSet.add(m.id);
                                else newSet.delete(m.id);
                                setSelectedForDeletion(newSet);
                              }}
                              className="rounded bg-neutral-900 border-neutral-700 text-red-500 focus:ring-red-500"
                            />
                            <span className="truncate text-xs font-mono flex-1">{calculateMeasurementLengthText(m, idx, studies)}</span>
                            {isRoi && (
                              <ChevronRight className={\`w-4 h-4 text-neutral-400 transition-transform \${m.isExpanded ? 'rotate-90' : ''}\`} />
                            )}
                          </div>
                          {isRoi && m.isExpanded && (
                            <div className="p-2 bg-neutral-950 text-xs font-mono text-neutral-400 grid grid-cols-2 gap-y-1 gap-x-2 border-t border-neutral-800">
                              <div>Area:</div>
                              <div className="text-right text-neutral-200">
                                {m.area !== undefined ? m.area.toFixed(2) : '--'}
                              </div>
                              
                              <div>Mean:</div>
                              <div className="text-right text-neutral-200">
                                {m.mean !== undefined ? m.mean.toFixed(1) : '--'}
                              </div>
                              
                              <div>Std Dev:</div>
                              <div className="text-right text-neutral-200">
                                {m.stdDev !== undefined ? m.stdDev.toFixed(1) : '--'}
                              </div>
                              
                              <div>Min:</div>
                              <div className="text-right text-neutral-200">
                                {m.min !== undefined ? m.min : '--'}
                              </div>
                              
                              <div>Max:</div>
                              <div className="text-right text-neutral-200">
                                {m.max !== undefined ? m.max : '--'}
                              </div>
                            </div>
                          )}
                        </div>
                      )})}
`;

code = code.replace(targetUI.trim(), replacementUI.trim());
fs.writeFileSync('app/page.tsx', code);
console.log("UI logic patched");
