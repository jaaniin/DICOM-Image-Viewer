const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

const targetCanvasLogic = `
             let mean = 0;
             let count = 0;
             try {
               const pixelData = enabledElement.image!.getPixelData();
               const width = enabledElement.image!.width;
               
               // Basic ray casting to determine if point is in polygon
               const isInside = (x: number, y: number) => {
                  let inside = false;
                  for (let i = 0, j = m.points!.length - 1; i < m.points!.length; j = i++) {
                    const xi = m.points![i].x, yi = m.points![i].y;
                    const xj = m.points![j].x, yj = m.points![j].y;
                    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                    if (intersect) inside = !inside;
                  }
                  return inside;
               };
               
               for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(enabledElement.image!.height - 1, Math.ceil(maxY)); y++) {
                 for (let x = Math.max(0, Math.floor(minX)); x <= Math.min(width - 1, Math.ceil(maxX)); x++) {
                   if (isInside(x, y)) {
                      let val = pixelData[y * width + x];
                      if (enabledElement.image!.slope) val = val * enabledElement.image!.slope;
                      if (enabledElement.image!.intercept) val = val + enabledElement.image!.intercept;
                      mean += val;
                      count++;
                   }
                 }
               }
               if (count > 0) mean = mean / count;
             } catch(err) {}
             
             if (count > 0) {
               m.mean = Math.round(mean);
             }
             
             lengthText = \`ROI \${label}: \${area.toFixed(1)} \${(pixelSpacing && pixelSpacing.length === 2) ? 'mm²' : 'px²'} (mean \${Math.round(mean)}\${modality === 'CT' ? ' HU' : ''})\`;
`;

const replacementCanvasLogic = `
             let sum = 0;
             let sumSq = 0;
             let count = 0;
             let minVal = Infinity;
             let maxVal = -Infinity;
             try {
               const pixelData = enabledElement.image!.getPixelData();
               const width = enabledElement.image!.width;
               
               // Basic ray casting to determine if point is in polygon
               const isInside = (x: number, y: number) => {
                  let inside = false;
                  for (let i = 0, j = m.points!.length - 1; i < m.points!.length; j = i++) {
                    const xi = m.points![i].x, yi = m.points![i].y;
                    const xj = m.points![j].x, yj = m.points![j].y;
                    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                    if (intersect) inside = !inside;
                  }
                  return inside;
               };
               
               for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(enabledElement.image!.height - 1, Math.ceil(maxY)); y++) {
                 for (let x = Math.max(0, Math.floor(minX)); x <= Math.min(width - 1, Math.ceil(maxX)); x++) {
                   if (isInside(x, y)) {
                      let val = pixelData[y * width + x];
                      if (enabledElement.image!.slope) val = val * enabledElement.image!.slope;
                      if (enabledElement.image!.intercept) val = val + enabledElement.image!.intercept;
                      sum += val;
                      sumSq += val * val;
                      if (val < minVal) minVal = val;
                      if (val > maxVal) maxVal = val;
                      count++;
                   }
                 }
               }
               if (count > 0) {
                 const mean = sum / count;
                 const variance = (sumSq - (sum * sum / count)) / count;
                 m.mean = Math.round(mean);
                 m.stdDev = Math.sqrt(Math.max(0, variance));
                 m.min = Math.round(minVal);
                 m.max = Math.round(maxVal);
                 m.area = area;
               }
             } catch(err) {}
             
             lengthText = \`ROI \${label}: \${area.toFixed(1)} \${(pixelSpacing && pixelSpacing.length === 2) ? 'mm²' : 'px²'} (mean \${m.mean !== undefined ? m.mean : '--'}\${modality === 'CT' ? ' HU' : ''})\`;
`;

code = code.replace(targetCanvasLogic, replacementCanvasLogic);
fs.writeFileSync('app/page.tsx', code);
console.log("Canvas logic patched");
