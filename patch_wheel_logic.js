const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

const oldWheelLogic = `
  const handleWheel = (e: React.WheelEvent, viewportIndex: number) => {
    const vp = viewports[viewportIndex];
    if (!vp.seriesInstanceUID) return;

    const study = studies.find(s => s.studyInstanceUID === vp.studyInstanceUID);
    const series = study?.series.find(s => s.seriesInstanceUID === vp.seriesInstanceUID);
    if (!series || series.instances.length <= 1) return;

    let newIndex = vp.imageIndex;
    if (e.deltaY > 0) {
      newIndex = Math.min(newIndex + 1, series.instances.length - 1); // Scroll down -> next image
    } else {
      newIndex = Math.max(newIndex - 1, 0); // Scroll up -> previous image
    }

    if (newIndex !== vp.imageIndex) {
      syncScrollToImage(viewportIndex, newIndex);
    }
  };
`;

const newWheelLogic = `
  const handleWheel = (e: React.WheelEvent, viewportIndex: number) => {
    const vp = viewports[viewportIndex];
    if (!vp.seriesInstanceUID) return;

    const study = studies.find(s => s.studyInstanceUID === vp.studyInstanceUID);
    const series = study?.series.find(s => s.seriesInstanceUID === vp.seriesInstanceUID);
    if (!series || series.instances.length <= 1) return;

    const now = performance.now();
    const timeSinceLastWheel = now - wheelTimeRef.current;
    wheelTimeRef.current = now;

    let step = 1;
    
    // Smooth scrolling devices often have small deltaY but very frequent events.
    // Notched mice have fixed deltaY (e.g. 100) and frequency depends on scroll speed.
    if (timeSinceLastWheel < 40) {
       wheelStreakRef.current += 1;
    } else {
       wheelStreakRef.current = 0;
    }

    // Base step on scroll streak
    if (wheelStreakRef.current > 15) {
      step = 15;
    } else if (wheelStreakRef.current > 8) {
      step = 10;
    } else if (wheelStreakRef.current > 3) {
      step = 5;
    }

    // Additional multiplier for very large single-event deltaY (aggressive trackpad swipes)
    if (Math.abs(e.deltaY) > 150) {
       step = Math.max(step, Math.floor(Math.abs(e.deltaY) / 100) * 3);
       step = Math.min(step, 20); // Cap max skip
    }

    let newIndex = vp.imageIndex;
    if (e.deltaY > 0) {
      newIndex = Math.min(newIndex + step, series.instances.length - 1); // Scroll down -> next image
    } else {
      newIndex = Math.max(newIndex - step, 0); // Scroll up -> previous image
    }

    if (newIndex !== vp.imageIndex) {
      syncScrollToImage(viewportIndex, newIndex);
    }
  };
`;

code = code.replace(oldWheelLogic.trim(), newWheelLogic.trim());
fs.writeFileSync('app/page.tsx', code);
console.log("Wheel logic patched");
