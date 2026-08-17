'use client';

import React, { useState, useRef, useEffect } from 'react';
let measurementIdCounter = 0;
import { Trash2, 
  SunMedium, 
  Move, 
  Search, 
  Ruler, 
  TriangleRight, 
  Circle,
  Square,
  Columns,
  Grid2X2,
  Save,
  FileText,
  FolderOpen,
  UploadCloud,
  Loader2,
  Info,
  X,
  Copy,
  Check,
  PanelRightClose,
  PanelRightOpen,
  Crosshair,
  AlertCircle,
  ChevronRight,
  Plus,
  RefreshCw,
  Github,
  HelpCircle,
  ListCollapse
} from 'lucide-react';
import { Tool, Layout, Tab, DICOMMetadata, DICOMInstance, DICOMSeries, Point, LengthMeasurement, DICOMStudy, ViewportState } from "../utils/types";
import { dot, cross, sub, add, mul, getDominantAxis, getOppositeAxis, getOrientationMarkers, calculateIntersection, crossProduct, dotProduct, subVectors, addVectors, scaleVector, getNormal } from "../utils/dicomGeometry";
import { AngleIcon, RoiIcon } from "../components/Icons";
import { generateReportText, generateReportFilename, downloadReportFile } from "../utils/reportGenerator";
import packageJson from "../package.json";

const currentVersion = packageJson.version || "0.7.0";

const readAllEntries = async (dirReader: FileSystemDirectoryReader): Promise<any[]> => {
  let allEntries: any[] = [];
  const readEntries = async () => {
    return new Promise<any[]>((resolve) => {
      dirReader.readEntries((entries: any[]) => resolve(entries));
    });
  };
  
  let entries = await readEntries();
  while(entries.length > 0) {
    allEntries = allEntries.concat(entries);
    entries = await readEntries();
  }
  return allEntries;
};

const traverseFileTree = async (item: any): Promise<File[]> => {
  if (item.isFile) {
    return new Promise<File[]>((resolve) => {
      item.file((file: File) => resolve([file]));
    });
  } else if (item.isDirectory) {
    const dirReader = item.createReader();
    const entries = await readAllEntries(dirReader);
    const filesPromises = entries.map(entry => traverseFileTree(entry));
    const filesArrays = await Promise.all(filesPromises);
    return filesArrays.flat();
  }
  return [];
};

const SeriesThumbnail = ({ instance }: { instance: DICOMInstance }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isActive = true;
    const element = containerRef.current;
    if (!element) return;

    import('cornerstone-core').then(cs => {
      const cornerstone = cs.default || cs;
      
      try {
        cornerstone.getEnabledElement(element);
      } catch (e) {
        cornerstone.enable(element);
      }

      cornerstone.loadImage(instance.imageId).then(image => {
        if (!isActive) return;
        cornerstone.displayImage(element, image);
        cornerstone.resize(element);
      }).catch(err => {
        console.warn("Thumbnail load error:", err);
      });
    });

  

  return () => {
      isActive = false;
      if (element) {
        import('cornerstone-core').then(cs => {
          const cornerstone = cs.default || cs;
          try {
            cornerstone.disable(element);
          } catch(e) {}
        });
      }
    };
  }, [instance.imageId]);

  return (
    <div 
      ref={containerRef} 
      className="w-12 h-12 bg-black rounded overflow-hidden shrink-0 pointer-events-none" 
    />
  );
};

const formatDicomDate = (dateStr?: string) => {
  if (!dateStr || dateStr.includes('Unknown') || dateStr.length < 8) return dateStr || 'Unknown';
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
};

const formatDicomTime = (timeStr?: string) => {
  if (!timeStr || timeStr.includes('Unknown') || timeStr.length < 6) return timeStr || '';
  return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
};

const formatNumber = (numStr?: string | number, decimals: number = 3) => {
  if (numStr === undefined || numStr === null || numStr === 'Unknown') return numStr;
  const num = typeof numStr === 'string' ? parseFloat(numStr) : numStr;
  if (isNaN(num)) return numStr;
  return parseFloat(num.toFixed(decimals)).toString();
};

export default function App() {
  const [isParsing, setIsParsing] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<{version: string, url: string} | null>(null);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>('wwc');
  const [layout, setLayout] = useState<Layout>(1);
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [reportText, setReportText] = useState('');
  const [studies, setStudies] = useState<DICOMStudy[]>([]);
  const [viewports, setViewports] = useState<ViewportState[]>(
    Array(4).fill({ studyInstanceUID: null, seriesInstanceUID: null, imageIndex: 0 })
  );
  const [dragOverViewport, setDragOverViewport] = useState<number | null>(null);
  const [activeViewportIndex, setActiveViewportIndex] = useState<number | null>(0);
  const [maximizedIndex, setMaximizedIndex] = useState<number | null>(null);
  const [activeInfoViewport, setActiveInfoViewport] = useState<number | null>(null);
  const [copiedRawDataIndex, setCopiedRawDataIndex] = useState<number | null>(null);
  const lastMultiButtonInteraction = useRef<number>(0);
  const isPointerDraggingRef = useRef<boolean>(false);

  const [measurements, setMeasurements] = useState<LengthMeasurement[]>([]);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isDraggingOverTrash, setIsDraggingOverTrash] = useState(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());
  const [draggingPoint, setDraggingPoint] = useState<{ id: string, point: string, isNew: boolean, lastPt?: any } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [patientMismatchDialog, setPatientMismatchDialog] = useState<{show: boolean, pendingInstances: DICOMInstance[]}>({show: false, pendingInstances: []});
  const [showRemoveAllDialog, setShowRemoveAllDialog] = useState(false);
  const mousePosRef = useRef<{x: number, y: number} | null>(null);
  const cursor3DRef = useRef<{ point: number[], sourceViewportIndex: number, studyInstanceUID?: string } | null>(null);
  const [cursor3DActive, setCursor3DActive] = useState(false); // To trigger renders
  const [reportSavedStatus, setReportSavedStatus] = useState(false);
  const [isReportCopied, setIsReportCopied] = useState(false);
  const viewportRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wheelTimeRef = useRef<number>(0);
  const wheelStreakRef = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showGlobalOverlay, setShowGlobalOverlay] = useState(false);
  const [overlayHoverZone, setOverlayHoverZone] = useState<'none' | 'left' | 'right' | 'single'>('none');

  const toggleSidebar = async () => {
    const willOpen = !isSidebarOpen;
    setIsSidebarOpen(willOpen);
    
    if (typeof document !== 'undefined' && document.fullscreenEnabled) {
      if (!willOpen) {
        if (!document.fullscreenElement) {
          try { await document.documentElement.requestFullscreen(); } catch (e) {}
        }
      } else {
        if (document.fullscreenElement) {
          try { await document.exitFullscreen(); } catch (e) {}
        }
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isSidebarOpen) {
        setIsSidebarOpen(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isSidebarOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const accepted = localStorage.getItem('dicom_viewer_disclaimer_accepted');
        if (!accepted) {
          setShowDisclaimer(true);
        }
      } catch {}
      setIsDisclaimerChecked(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/jaaniin/div.DICOM/releases/latest');
        if (res.ok) {
          const data = await res.json();
          const latestVersion = data.tag_name.replace(/^v/, '');
          
          const currentParts = currentVersion.split('.').map(Number);
          const latestParts = latestVersion.split('.').map(Number);
          
          let isNewer = false;
          for (let i = 0; i < 3; i++) {
            if ((latestParts[i] || 0) > (currentParts[i] || 0)) {
              isNewer = true;
              break;
            } else if ((latestParts[i] || 0) < (currentParts[i] || 0)) {
              break;
            }
          }
          
          if (isNewer) {
            setUpdateAvailable({ version: data.tag_name, url: data.html_url });
          }
        }
      } catch (e) {
        console.warn("Failed to check for updates");
      }
    };
    checkUpdate();
  }, []);

  const handleRemoveSeries = (e: React.MouseEvent, studyUID: string, seriesUID: string) => {
    e.stopPropagation();
    
    // Find imageIds to remove associated measurements
    const studyToRemoveFrom = studies.find(s => s.studyInstanceUID === studyUID);
    const seriesToRemove = studyToRemoveFrom?.series.find(s => s.seriesInstanceUID === seriesUID);
    if (seriesToRemove) {
      const removedImageIds = new Set(seriesToRemove.instances.map(inst => inst.imageId));
      setMeasurements(prev => prev.filter(m => !removedImageIds.has(m.imageId)));
    }

    // Remove from loaded studies
    setStudies(prevStudies => {
      const newStudies = prevStudies.map(study => {
        if (study.studyInstanceUID === studyUID) {
          return {
            ...study,
            series: study.series.filter(s => s.seriesInstanceUID !== seriesUID)
          };
        }
        return study;
      }).filter(study => study.series.length > 0);
      
      return newStudies;
    });

    // Clear from viewports if loaded
    setViewports(prev => prev.map((vp, index) => {
      if (vp.studyInstanceUID === studyUID && vp.seriesInstanceUID === seriesUID) {
         // Clear the canvas physically via Cornerstone
         import('cornerstone-core').then(cs => {
           const cornerstone = cs.default || cs;
           const el = viewportRefs.current[index];
           if (el) {
             try {
               cornerstone.disable(el);
               cornerstone.enable(el);
             } catch(err) {}
           }
         });
         return { ...vp, studyInstanceUID: null, seriesInstanceUID: null, imageIndex: 0 };
      }
      return vp;
    }));
  };

  const handleAcceptDisclaimer = () => {
    localStorage.setItem('dicom_viewer_disclaimer_accepted', 'true');
    setShowDisclaimer(false);
  };

  useEffect(() => {
    import('cornerstone-core').then(cs => {
      const cornerstone = cs.default || cs;
      // Delay to let CSS transitions or React DOM updates finish
      setTimeout(() => {
        viewportRefs.current.forEach(el => {
          if (el) {
            try {
              cornerstone.resize(el, true);
            } catch(e) {}
          }
        });
      }, 50);
    });
  }, [layout]);

  useEffect(() => {
    import('cornerstone-core').then(cs => {
      const cornerstone = cs.default || cs;
      // Delay to let CSS transitions or React DOM updates finish
      setTimeout(() => {
        viewportRefs.current.forEach(el => {
          if (el) {
            try {
              cornerstone.resize(el, false);
            } catch(e) {}
          }
        });
      }, 50);
    });
  }, [maximizedIndex]);

  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        import('cornerstone-core').then(cs => {
          const cornerstone = cs.default || cs;
          viewportRefs.current.forEach(el => {
            if (el) {
              try {
                cornerstone.resize(el, true);
              } catch(e) {}
            }
          });
        });
      }, 50); // Debounce resize for performance
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, []);

  useEffect(() => {
    // When sidebar toggles, we need to wait for CSS transition to finish (300ms) before resizing the canvas
    const timer = setTimeout(() => {
      import('cornerstone-core').then(cs => {
        const cornerstone = cs.default || cs;
        viewportRefs.current.forEach(el => {
          if (el) {
            try { cornerstone.resize(el); } catch (e) {}
          }
        });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [isSidebarOpen]);

  const handleCopyRawData = (e: React.MouseEvent, index: number, rawTags: Array<{tag: string, name: string, value: string}>) => {
    e.stopPropagation();
    const text = rawTags.map(rt => `${rt.name} ${rt.tag}: ${rt.value}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedRawDataIndex(index);
      setTimeout(() => setCopiedRawDataIndex(null), 2000);
    }).catch(err => console.error("Clipboard copy failed", err));
  };

  const handleDoubleClick = (e: React.MouseEvent, index: number) => {
    if (e.button !== 0) return; // Double-click only with the left mouse button
    if (window.performance.now() - lastMultiButtonInteraction.current < 150) return; // Prevent accidental clicks after zooming
    if (layout === 1) return;
    setMaximizedIndex(prev => prev === index ? null : index);
  };
  
  const stateRef = useRef({ activeViewportIndex, viewports, studies, measurements, mousePosRef, cursor3DRef, activeTool });
  useEffect(() => {
    stateRef.current = { activeViewportIndex, viewports, studies, measurements, mousePosRef, cursor3DRef, activeTool };
  }, [activeViewportIndex, viewports, studies, measurements, activeTool, cursor3DActive]);

  const updateOtherViewports = async (sourceIndex: number) => {
    const cs = await import('cornerstone-core');
    const cornerstone = cs.default || cs;
    viewportRefs.current.forEach((el, i) => {
      if (i !== sourceIndex && el) {
        try {
          cornerstone.updateImage(el);
        } catch(e) {}
      }
    });
  };

  useEffect(() => {
    if (activeViewportIndex !== null) {
      updateOtherViewports(activeViewportIndex);
    }
  }, [activeViewportIndex]);
  
  // Measurement calculation helpers


  
  const calculateMeasurementLengthText = (m: LengthMeasurement, index: number, allStudies: DICOMStudy[]) => {
    let label = String.fromCharCode(65 + (index % 26)); // A, B, C...
    if (m.type === 'roi') {
      if (!m.points || m.points.length < 3) return `ROI ${label}: --`;
      let area = 0;
      for (let i = 0; i < m.points.length; i++) {
        const p1 = m.points[i];
        const p2 = m.points[(i + 1) % m.points.length];
        area += (p1.x * p2.y - p2.x * p1.y);
      }
      area = Math.abs(area) / 2;

      let pixelSpacing = null;
      let modality = null;
      for (const study of allStudies) {
        for (const series of study.series) {
          const inst = series.instances.find(i => i.imageId === m.imageId);
          if (inst) { 
            pixelSpacing = inst.metadata.pixelSpacing; 
            modality = inst.metadata.modality || series.modality;
            break; 
          }
        }
        if (pixelSpacing || modality) break;
      }
      let areaText = '';
      if (pixelSpacing && pixelSpacing.length >= 2) {
        const psArea = pixelSpacing[0] * pixelSpacing[1];
        area = area * psArea;
        areaText = area.toFixed(1) + ' mm²';
      } else {
        areaText = area.toFixed(1) + ' px²';
      }
      const meanPart = m.mean !== undefined ? ` (mean ${m.mean}${modality === 'CT' ? ' HU' : ''})` : '';
      return `ROI ${label}: ${m.isClosed ? (areaText + meanPart) : '--'}`;
    }

    if (m.type === 'angle') {
      const l1 = String.fromCharCode(97 + ((index * 2) % 26));
      const l2 = String.fromCharCode(97 + ((index * 2 + 1) % 26));
      label = `${l1}-${l2}`;
      if (!m.start2 || !m.end2) return `${label}: --°`;
      let pixelSpacing = null;
      for (const study of allStudies) {
        for (const series of study.series) {
          const inst = series.instances.find(i => i.imageId === m.imageId);
          if (inst) { pixelSpacing = inst.metadata.pixelSpacing; break; }
        }
        if (pixelSpacing) break;
      }
      const sx = pixelSpacing ? pixelSpacing[1] : 1;
      const sy = pixelSpacing ? pixelSpacing[0] : 1;
      const p1 = { x: m.start.x * sx, y: m.start.y * sy };
      const p2 = { x: m.end.x * sx, y: m.end.y * sy };
      const p3 = { x: m.start2.x * sx, y: m.start2.y * sy };
      const p4 = { x: m.end2.x * sx, y: m.end2.y * sy };

      const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
      if (Math.abs(denom) < 1e-5) return `${label}: 0.0°`;
      
      const ix = ((p1.x * p2.y - p1.y * p2.x) * (p3.x - p4.x) - (p1.x - p2.x) * (p3.x * p4.y - p3.y * p4.x)) / denom;
      const iy = ((p1.x * p2.y - p1.y * p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x * p4.y - p3.y * p4.x)) / denom;
      
      const mid1 = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
      const mid2 = { x: (p3.x + p4.x)/2, y: (p3.y + p4.y)/2 };
      
      const a1 = Math.atan2(mid1.y - iy, mid1.x - ix);
      const a2 = Math.atan2(mid2.y - iy, mid2.x - ix);
      let angleDiff = Math.abs(a1 - a2) * (180 / Math.PI);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;
      
      let angleStr = `${angleDiff.toFixed(1)}°`;
      if (angleDiff > 90) {
        const comp = 180 - angleDiff;
        angleStr = `${angleDiff.toFixed(1)}° / ${comp.toFixed(1)}°`;
      }
      
      return `${label}: ${angleStr}`;
    }

    const dx = m.end.x - m.start.x;
    const dy = m.end.y - m.start.y;
    let pixelSpacing = null;
    for (const study of allStudies) {
      for (const series of study.series) {
        const inst = series.instances.find(i => i.imageId === m.imageId);
        if (inst) {
          pixelSpacing = inst.metadata.pixelSpacing;
          break;
        }
      }
      if (pixelSpacing) break;
    }
    let lengthText = '';
    if (pixelSpacing && pixelSpacing.length >= 2) {
      const rowSpacing = pixelSpacing[0];
      const colSpacing = pixelSpacing[1];
      const lengthMm = Math.sqrt(Math.pow(dx * colSpacing, 2) + Math.pow(dy * rowSpacing, 2));
      lengthText = lengthMm.toFixed(1) + ' mm';
    } else {
      const lengthPixels = Math.sqrt(dx * dx + dy * dy);
      lengthText = lengthPixels.toFixed(1) + ' px';
    }
    return `${label}: ${lengthText}`;
  };

  const drawMeasurements = (e: React.MouseEvent | React.ChangeEvent | any) => {
    const state = stateRef.current;
    const ctx = e.detail.canvasContext;
    const element = e.detail.element;
    const imageId = e.detail.image.imageId;
    
    const allMeasurements = [...state.measurements];
    if (allMeasurements.length === 0) return;
    
    import('cornerstone-core').then(cs => {
      const cornerstone = cs.default || cs;
      
      let enabledElement;
      try { enabledElement = cornerstone.getEnabledElement(element); } catch(err) { return; }
      if (!enabledElement || !enabledElement.image) return;
      const scale = enabledElement?.viewport?.scale || 1;
      const threshold = 10 / scale; // 10 screen pixels threshold for hover
      
      let mouseImagePt = null;
      if (state.mousePosRef?.current) {
         try {
           mouseImagePt = cornerstone.pageToPixel(element, state.mousePosRef.current.x, state.mousePosRef.current.y);
         } catch(e) {}
      }
      
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      allMeasurements.forEach(m => {
        if (m.imageId !== imageId) return;
        
        let index = state.measurements.findIndex(meas => meas.id === m.id);
        if (index === -1) index = state.measurements.length;
        
        const drawLineAndPoints = (start: any, end: any, isHoverStart: boolean, isHoverEnd: boolean, isAngle: boolean, lineLabel: string) => {
          const pt1 = cornerstone.pixelToCanvas(element, start);
          const pt2 = cornerstone.pixelToCanvas(element, end);
          
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = 'rgba(52, 211, 153, 0.8)';
          if (isAngle) {
            ctx.beginPath(); ctx.arc(pt1.x, pt1.y, 4, 0, 2 * Math.PI); ctx.fill();
            ctx.beginPath(); ctx.arc(pt2.x, pt2.y, 4, 0, 2 * Math.PI); ctx.fill();
          } else {
            const lengthPx = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y);
            const ux = lengthPx > 0 ? (pt2.x - pt1.x) / lengthPx : 0;
            const uy = lengthPx > 0 ? (pt2.y - pt1.y) / lengthPx : 0;
            const px = -uy;
            const py = ux;
            const tBarW = 6;
            
            if (isHoverStart) {
              ctx.beginPath(); ctx.arc(pt1.x, pt1.y, 4, 0, 2 * Math.PI); ctx.fill();
            } else {
              ctx.beginPath(); ctx.moveTo(pt1.x + px * tBarW, pt1.y + py * tBarW); ctx.lineTo(pt1.x - px * tBarW, pt1.y - py * tBarW); ctx.stroke();
            }
            if (isHoverEnd) {
              ctx.beginPath(); ctx.arc(pt2.x, pt2.y, 4, 0, 2 * Math.PI); ctx.fill();
            } else {
              ctx.beginPath(); ctx.moveTo(pt2.x + px * tBarW, pt2.y + py * tBarW); ctx.lineTo(pt2.x - px * tBarW, pt2.y - py * tBarW); ctx.stroke();
            }
          }

          // Draw badge in the middle
          const midX = (pt1.x + pt2.x) / 2;
          const midY = (pt1.y + pt2.y) / 2;
          
          ctx.beginPath();
          ctx.arc(midX, midY, 9, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#34d399';
          ctx.font = '11px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(lineLabel, midX, midY + 1);

          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';

          return { pt1, pt2 };
        };

        let hoverStart = false, hoverEnd = false;
        let hoverStart2 = false, hoverEnd2 = false;
        
        if (mouseImagePt) {
           if (Math.hypot(m.start.x - mouseImagePt.x, m.start.y - mouseImagePt.y) < threshold) hoverStart = true;
           if (Math.hypot(m.end.x - mouseImagePt.x, m.end.y - mouseImagePt.y) < threshold) hoverEnd = true;
           if (m.start2 && m.end2) {
             if (Math.hypot(m.start2.x - mouseImagePt.x, m.start2.y - mouseImagePt.y) < threshold) hoverStart2 = true;
             if (Math.hypot(m.end2.x - mouseImagePt.x, m.end2.y - mouseImagePt.y) < threshold) hoverEnd2 = true;
           }
        }

        if (m.type === 'roi') {
          if (!m.points || m.points.length === 0) return;
          const canvasPts = m.points.map(pt => cornerstone.pixelToCanvas(element, pt as any));
          
          ctx.beginPath();
          ctx.moveTo(canvasPts[0].x, canvasPts[0].y);
          for (let i = 1; i < canvasPts.length; i++) {
             ctx.lineTo(canvasPts[i].x, canvasPts[i].y);
          }
          
          let closedLineEnd = null;
          if (!m.isClosed && mouseImagePt && state.activeTool === 'roi') {
             const mPt = cornerstone.pixelToCanvas(element, mouseImagePt);
             ctx.lineTo(mPt.x, mPt.y);
             closedLineEnd = mPt;
          }

          if (m.isClosed) {
             ctx.lineTo(canvasPts[0].x, canvasPts[0].y);
          }
          
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Only preview dashed closing line back to start while actively drawing an open ROI
          if (!m.isClosed && closedLineEnd) {
             ctx.beginPath();
             ctx.moveTo(closedLineEnd.x, closedLineEnd.y);
             ctx.lineTo(canvasPts[0].x, canvasPts[0].y);
             ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
             ctx.lineWidth = 2;
             ctx.setLineDash([5, 5]);
             ctx.stroke();
             ctx.setLineDash([]);
          }

          // Draw points
          ctx.fillStyle = 'rgba(52, 211, 153, 0.8)';
          canvasPts.forEach(pt => {
             ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI); ctx.fill();
          });

          const label = String.fromCharCode(65 + (index % 26));
          ctx.font = '14px Arial';
          
          let textX = canvasPts[0].x + 10;
          let textY = canvasPts[0].y - 10;
          
          let lengthText = `ROI ${label}: --`;
          if (m.isClosed) {
             let area = 0;
             for (let i = 0; i < m.points!.length; i++) {
               const p1 = m.points![i];
               const p2 = m.points![(i + 1) % m.points!.length];
               area += (p1.x * p2.y - p2.x * p1.y);
             }
             area = Math.abs(area) / 2;
             
             // Pixel spacing
             let pixelSpacing = null;
             let modality = null;
             for (const study of state.studies) {
               for (const series of study.series) {
                 const inst = series.instances.find(i => i.imageId === m.imageId);
                 if (inst) { 
                    pixelSpacing = inst.metadata.pixelSpacing; 
                    modality = inst.metadata.modality || series.modality;
                    break; 
                 }
               }
               if (pixelSpacing || modality) break;
             }
             
             if (pixelSpacing && pixelSpacing.length === 2) {
               const psArea = pixelSpacing[0] * pixelSpacing[1];
               area = area * psArea;
             }
             
             // Very simple mean estimation based on bounding box
             let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
             m.points!.forEach(p => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
             });
             
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
             
             lengthText = `ROI ${label}: ${area.toFixed(1)} ${(pixelSpacing && pixelSpacing.length === 2) ? 'mm²' : 'px²'} (mean ${m.mean !== undefined ? m.mean : '--'}${modality === 'CT' ? ' HU' : ''})`;
          }
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          const textWidth = ctx.measureText(lengthText).width;
          ctx.fillRect(textX - 2, textY - 14, textWidth + 4, 18);
          ctx.fillStyle = '#34d399';
          ctx.fillText(lengthText, textX, textY);
          
          return;
        }

        const isAngle = m.type === 'angle';
        
        let line1Label = String.fromCharCode(65 + (index % 26)); // A, B, C...
        let line2Label = '';
        if (isAngle) {
          line1Label = String.fromCharCode(97 + ((index * 2) % 26)); // a, c, e
          line2Label = String.fromCharCode(97 + ((index * 2 + 1) % 26)); // b, d, f
        }

        const { pt1, pt2 } = drawLineAndPoints(m.start, m.end, hoverStart, hoverEnd, isAngle, line1Label);
        
        let pt1_2 = { x: 0, y: 0 }, pt2_2 = { x: 0, y: 0 };
        if (isAngle && m.start2 && m.end2) {
           const res = drawLineAndPoints(m.start2, m.end2, hoverStart2, hoverEnd2, true, line2Label);
           pt1_2 = res.pt1;
           pt2_2 = res.pt2;
        }

        const lengthText = calculateMeasurementLengthText(m, index, state.studies);
        ctx.font = '14px Arial';
        
        let textX = 0, textY = 0;
        
        if (m.type === 'angle') {
           if (!m.start2 || !m.end2) {
              textX = pt2.x + 10;
              textY = pt2.y - 10;
           } else {
              const denom = (pt1.x - pt2.x) * (pt1_2.y - pt2_2.y) - (pt1.y - pt2.y) * (pt1_2.x - pt2_2.x);
              if (Math.abs(denom) > 1e-5) {
                const intersectX = ((pt1.x * pt2.y - pt1.y * pt2.x) * (pt1_2.x - pt2_2.x) - (pt1.x - pt2.x) * (pt1_2.x * pt2_2.y - pt1_2.y * pt2_2.x)) / denom;
                const intersectY = ((pt1.x * pt2.y - pt1.y * pt2.x) * (pt1_2.y - pt2_2.y) - (pt1.y - pt2.y) * (pt1_2.x * pt2_2.y - pt1_2.y * pt2_2.x)) / denom;
                
                const mid1 = { x: (pt1.x + pt2.x)/2, y: (pt1.y + pt2.y)/2 };
                const mid2 = { x: (pt1_2.x + pt2_2.x)/2, y: (pt1_2.y + pt2_2.y)/2 };
                const a1 = Math.atan2(mid1.y - intersectY, mid1.x - intersectX);
                const a2 = Math.atan2(mid2.y - intersectY, mid2.x - intersectX);
                
                const r1 = Math.hypot(mid1.x - intersectX, mid1.y - intersectY);
                const r2 = Math.hypot(mid2.x - intersectX, mid2.y - intersectY);
                const radius = Math.min(r1, r2);
                
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(intersectX, intersectY, radius, Math.min(a1, a2), Math.max(a1, a2), Math.abs(a1 - a2) > Math.PI);
                ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.setLineDash([4, 4]);
                ctx.lineWidth = 1.5;

                const dot1 = (pt1.x - intersectX) * (pt2.x - intersectX) + (pt1.y - intersectY) * (pt2.y - intersectY);
                if (dot1 > 0) {
                  const closest1 = Math.hypot(pt1.x - intersectX, pt1.y - intersectY) < Math.hypot(pt2.x - intersectX, pt2.y - intersectY) ? pt1 : pt2;
                  ctx.beginPath();
                  ctx.moveTo(closest1.x, closest1.y);
                  ctx.lineTo(intersectX, intersectY);
                  ctx.stroke();
                }

                const dot2 = (pt1_2.x - intersectX) * (pt2_2.x - intersectX) + (pt1_2.y - intersectY) * (pt2_2.y - intersectY);
                if (dot2 > 0) {
                  const closest2 = Math.hypot(pt1_2.x - intersectX, pt1_2.y - intersectY) < Math.hypot(pt2_2.x - intersectX, pt2_2.y - intersectY) ? pt1_2 : pt2_2;
                  ctx.beginPath();
                  ctx.moveTo(closest2.x, closest2.y);
                  ctx.lineTo(intersectX, intersectY);
                  ctx.stroke();
                }

                ctx.setLineDash([]);
                
                const midAngle = (a1 + a2) / 2 + (Math.abs(a1 - a2) > Math.PI ? Math.PI : 0);
                textX = intersectX + radius * Math.cos(midAngle);
                textY = intersectY + radius * Math.sin(midAngle);
              } else {
                textX = ((pt1.x + pt2.x) / 2 + (pt1_2.x + pt2_2.x) / 2) / 2;
                textY = ((pt1.y + pt2.y) / 2 + (pt1_2.y + pt2_2.y) / 2) / 2;
              }
           }
        } else {
           textX = (pt1.x + pt2.x) / 2 + 10;
           textY = (pt1.y + pt2.y) / 2 - 10;
        }

        const metrics = ctx.measureText(lengthText);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(textX - 2, textY - 12, metrics.width + 4, 16);
        ctx.fillStyle = '#34d399';
        ctx.fillText(lengthText, textX, textY);
      });
      
      ctx.restore();
    });
  };

  const drawReferenceLine = (e: React.MouseEvent | React.ChangeEvent | any, currentViewportIndex: number) => {
    drawMeasurements(e);
    
    const state = stateRef.current;
    if (state.cursor3DRef?.current && state.activeTool === 'pixel') return;
    
    const activeIndex = state.activeViewportIndex;
    if (activeIndex === null || activeIndex === currentViewportIndex) return;

    const currentVp = state.viewports[currentViewportIndex];
    const activeVp = state.viewports[activeIndex];

    if (!currentVp.studyInstanceUID || !activeVp.studyInstanceUID) return;
    if (currentVp.studyInstanceUID !== activeVp.studyInstanceUID) return;

    const study = state.studies.find(s => s.studyInstanceUID === currentVp.studyInstanceUID);
    if (!study) return;

    const currentSeries = study.series.find(s => s.seriesInstanceUID === currentVp.seriesInstanceUID);
    const activeSeries = study.series.find(s => s.seriesInstanceUID === activeVp.seriesInstanceUID);
    if (!currentSeries || !activeSeries) return;

    const currentInst = currentSeries.instances[currentVp.imageIndex];
    const activeInst = activeSeries.instances[activeVp.imageIndex];
    if (!currentInst || !activeInst) return;

    const pts = calculateIntersection(activeInst.metadata, currentInst.metadata);
    if (pts && pts.length === 2) {
      import('cornerstone-core').then(cs => {
        const cornerstone = cs.default || cs;
        const element = e.currentTarget || e.target;
        const pt1 = cornerstone.pixelToCanvas(element, pts[0] as any);
        const pt2 = cornerstone.pixelToCanvas(element, pts[1] as any);

        const ctx = e.detail.canvasContext;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to identity
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.strokeStyle = 'rgba(132, 204, 22, 0.8)'; // Lime-500
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      });
    }
  };

  const drawPixelProbe = (e: React.MouseEvent | React.ChangeEvent | any) => {
    const state = stateRef.current;
    if (state.activeTool !== 'pixel') return;
    
    const element = e.detail.element;
    const image = e.detail.image;
    if (!image) return;
    
    const viewportIndex = state.viewports.findIndex(vp => vp.seriesInstanceUID && element.id && element.id.includes(`viewport-${viewportIndex}`));
    // wait, we don't have element.id = viewport-X
    // but e.currentTarget or element is in viewportRefs
    let vpIdx = -1;
    // Actually we can just use the DOM to find it or just compare with viewportRefs.current inside a setTimeout? No, we shouldn't use viewportRefs if we can't access it. But we CAN access viewportRefs.current in this scope!
    
    const viewportRefsList = viewportRefs?.current || [];
    for (let i = 0; i < viewportRefsList.length; i++) {
       if (viewportRefsList[i] === element) {
          vpIdx = i;
          break;
       }
    }
    
    if (vpIdx === -1) return;

    let isSourceViewport = false;
    let isTargetViewport = false;
    let targetPixelPt: {x: number, y: number} | null = null;
    let isOutofBounds = false;
    
    const cursor3D = state.cursor3DRef?.current;
    if (cursor3D) {
       if (cursor3D.sourceViewportIndex === vpIdx) {
          isSourceViewport = true;
       } else {
          const vpInfo = state.viewports[vpIdx];
          if (cursor3D.studyInstanceUID && vpInfo.studyInstanceUID !== cursor3D.studyInstanceUID) return;
          isTargetViewport = true;
          const study = state.studies.find(s => s.studyInstanceUID === vpInfo.studyInstanceUID);
          const series = study?.series.find(s => s.seriesInstanceUID === vpInfo.seriesInstanceUID);
          const instance = series?.instances[vpInfo.imageIndex];
          
          if (instance && instance.metadata.imagePositionPatient && instance.metadata.imageOrientationPatient && instance.metadata.pixelSpacing) {
             const S = instance.metadata.imagePositionPatient;
             const X = instance.metadata.imageOrientationPatient.slice(0, 3);
             const Y = instance.metadata.imageOrientationPatient.slice(3, 6);
             const px = instance.metadata.pixelSpacing[1];
             const py = instance.metadata.pixelSpacing[0];
             
             const diff = subVectors(cursor3D.point, S);
             const u = dotProduct(diff, X) / px;
             const v = dotProduct(diff, Y) / py;
             targetPixelPt = { x: u, y: v };
             
             const N = getNormal(instance.metadata.imageOrientationPatient);
             const d = Math.abs(dotProduct(diff, N));
             const sliceThickness = parseFloat(instance.metadata.sliceThickness || '2.0');
             if (d > sliceThickness) {
                isOutofBounds = true;
             }
          }
       }
    }
    
    const mousePos = state.mousePosRef?.current;
    const rect = element.getBoundingClientRect();
    const isMouseInBounds = mousePos && (
      mousePos.x >= rect.left && 
      mousePos.x <= rect.right && 
      mousePos.y >= rect.top && 
      mousePos.y <= rect.bottom
    );
    
    import('cornerstone-core').then(cs => {
      const cornerstone = cs.default || cs;
      
      let mouseImagePt: any = null;
      if (isMouseInBounds) {
        try {
          mouseImagePt = cornerstone.pageToPixel(element, mousePos!.x, mousePos!.y);
        } catch (err) {}
      }

      const ctx = e.detail.canvasContext;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to identity for canvas drawing

      let modality = null;
      const vpInfo = state.viewports[vpIdx];
      if (vpInfo) {
          const study = state.studies.find(s => s.studyInstanceUID === vpInfo.studyInstanceUID);
          const series = study?.series.find(s => s.seriesInstanceUID === vpInfo.seriesInstanceUID);
          if (series) modality = series.modality;
      }
      
      const drawCross = (canvasPt: {x: number, y: number}, val: number | null, isGhost: boolean) => {
         ctx.beginPath();
         ctx.strokeStyle = isGhost ? 'rgba(16, 185, 129, 0.4)' : '#10b981'; // emerald-500
         ctx.lineWidth = 1.5;
         if (isGhost) ctx.setLineDash([2, 2]);
         
         const crossSize = 8;
         const gap = 4;
         // Top
         ctx.moveTo(canvasPt.x, canvasPt.y - gap);
         ctx.lineTo(canvasPt.x, canvasPt.y - gap - crossSize);
         // Bottom
         ctx.moveTo(canvasPt.x, canvasPt.y + gap);
         ctx.lineTo(canvasPt.x, canvasPt.y + gap + crossSize);
         // Left
         ctx.moveTo(canvasPt.x - gap, canvasPt.y);
         ctx.lineTo(canvasPt.x - gap - crossSize, canvasPt.y);
         // Right
         ctx.moveTo(canvasPt.x + gap, canvasPt.y);
         ctx.lineTo(canvasPt.x + gap + crossSize, canvasPt.y);
         ctx.stroke();
         ctx.setLineDash([]);
         
         if (val !== null && !isGhost) {
            ctx.font = '12px sans-serif';
            const text = `${Math.round(val)}${modality === 'CT' ? ' HU' : ''}`;
            const textWidth = ctx.measureText(text).width;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(canvasPt.x + gap + 4, canvasPt.y + gap + 4, textWidth + 12, 22);
            ctx.fillStyle = '#10b981';
            ctx.fillText(text, canvasPt.x + gap + 10, canvasPt.y + gap + 20);
         }
      };

      if (mouseImagePt && isMouseInBounds) {
         const x = Math.round(mouseImagePt.x);
         const y = Math.round(mouseImagePt.y);
         if (x >= 0 && y >= 0 && x < image.columns && y < image.rows) {
            const storedPixelValue = image.getPixelData()[y * image.columns + x];
            const modalityPixelValue = storedPixelValue * image.slope + image.intercept;
            const canvasPt = cornerstone.pixelToCanvas(element, mouseImagePt);
            drawCross(canvasPt, modalityPixelValue, false);
         }
      } else if (isTargetViewport && targetPixelPt && !isOutofBounds) {
         const x = Math.round(targetPixelPt.x);
         const y = Math.round(targetPixelPt.y);
         if (x >= 0 && y >= 0 && x < image.columns && y < image.rows) {
            const canvasPt = cornerstone.pixelToCanvas(element, targetPixelPt as any);
            drawCross(canvasPt, null, false);
         }
      }
      
      ctx.restore();
    });
  };

  // Function to render a specific instance in a viewport
  const renderViewportImage = async (viewportIndex: number, instance: DICOMInstance, fit: boolean = false) => {
    const element = viewportRefs.current[viewportIndex];
    if (!element) return;
    try {
      const cs = await import('cornerstone-core');
      const cornerstone = cs.default || cs;
      
      try {
        cornerstone.getEnabledElement(element);
      } catch (err) {
        cornerstone.enable(element);
        
        // Setup high-performance overlay updates
        element.addEventListener('cornerstoneimagerendered', (e: React.MouseEvent | React.ChangeEvent | any) => {
          const viewport = e.detail.viewport;
          const overlay = document.getElementById(`overlay-wl-zoom-${viewportIndex}`);
          if (overlay) {
             overlay.innerHTML = `WL: ${Math.round(viewport.voi.windowCenter)} WW: ${Math.round(viewport.voi.windowWidth)}`;
          }
          drawReferenceLine(e, viewportIndex);
          drawPixelProbe(e);
        });
      }
      
      const image = await cornerstone.loadImage(instance.imageId);
      if (fit) {
        const defaultViewport = cornerstone.getDefaultViewportForImage(element, image);
        cornerstone.displayImage(element, image, defaultViewport);
      } else {
        cornerstone.displayImage(element, image);
      }
    } catch (err) {
      console.error("Error loading DICOM image into Cornerstone:", err);
    }
  };

  // 3D Cursor Sync logic
  useEffect(() => {
    if (!cursor3DRef.current || activeTool !== 'pixel') {
       viewportRefs.current.forEach((el) => {
          if (el) {
             import('cornerstone-core').then(cs => {
                const cornerstone = cs.default || cs;
                try {
                   cornerstone.getEnabledElement(el);
                   cornerstone.updateImage(el);
                } catch(e) {}
             });
          }
       });
       return;
    }
    const { point, sourceViewportIndex } = cursor3DRef.current;
    
    let updated = false;
    const newViewports = [...viewports];
    
    newViewports.forEach((vp, i) => {
       if (i === sourceViewportIndex || !vp.seriesInstanceUID) return;
       if (cursor3DRef.current?.studyInstanceUID && vp.studyInstanceUID !== cursor3DRef.current.studyInstanceUID) return;
       const study = studies.find(s => s.studyInstanceUID === vp.studyInstanceUID);
       const series = study?.series.find(s => s.seriesInstanceUID === vp.seriesInstanceUID);
       if (!series) return;
       
       let minDistance = Infinity;
       let bestIndex = -1;
       
       series.instances.forEach((inst, idx) => {
          if (!inst.metadata.imagePositionPatient || !inst.metadata.imageOrientationPatient) return;
          const S = inst.metadata.imagePositionPatient;
          const N = getNormal(inst.metadata.imageOrientationPatient);
          const d = Math.abs(dotProduct(subVectors(point, S), N));
          if (d < minDistance) {
             minDistance = d;
             bestIndex = idx;
          }
       });
       
       if (bestIndex !== -1 && bestIndex !== vp.imageIndex) {
          newViewports[i] = { ...vp, imageIndex: bestIndex };
          updated = true;
          // Trigger the Cornerstone image load for this viewport
          renderViewportImage(i, series.instances[bestIndex]);
       }
    });
    
    if (updated) {
       setViewports(newViewports);
       requestAnimationFrame(() => updateOtherViewports(sourceViewportIndex));
    } else {
       updateOtherViewports(sourceViewportIndex);
    }
  }, [cursor3DActive, activeTool, studies, viewports]);


    const handlePointerDown = async (e: React.PointerEvent, viewportIndex: number) => {
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    try {
      target.setPointerCapture(pointerId);
    } catch(err) {}
    setActiveViewportIndex(viewportIndex);
    
    if (e.button === 0) {
      const element = viewportRefs.current[viewportIndex];
      if (!element) return;
      const cs = await import('cornerstone-core');
      const cornerstone = cs.default || cs;
      
      let enabledElement;
      try {
        enabledElement = cornerstone.getEnabledElement(element);
      } catch (err) {
        return;
      }
      if (!enabledElement || !enabledElement.image) return;
      
      const imagePt = cornerstone.pageToPixel(element, e.pageX, e.pageY) as any;
      const imageId = enabledElement.image.imageId;
      
      const threshold = 10 / (enabledElement.viewport?.scale || 1);
      
      if (activeTool === 'pixel') {
         mousePosRef.current = { x: e.pageX, y: e.pageY };
         const vpInfo = viewports[viewportIndex];
         const study = studies.find(s => s.studyInstanceUID === vpInfo.studyInstanceUID);
         const series = study?.series.find(s => s.seriesInstanceUID === vpInfo.seriesInstanceUID);
         const instance = series?.instances[vpInfo.imageIndex];
         
         if (instance && instance.metadata.imagePositionPatient && instance.metadata.imageOrientationPatient && instance.metadata.pixelSpacing) {
            const S = instance.metadata.imagePositionPatient;
            const X = instance.metadata.imageOrientationPatient.slice(0, 3);
            const Y = instance.metadata.imageOrientationPatient.slice(3, 6);
            const px = instance.metadata.pixelSpacing[1];
            const py = instance.metadata.pixelSpacing[0];
            
            const P_world = addVectors(
               S,
               addVectors(
                  scaleVector(X, imagePt.x * px),
                  scaleVector(Y, imagePt.y * py)
               )
            );
            
            cursor3DRef.current = { point: P_world, sourceViewportIndex: viewportIndex, studyInstanceUID: vpInfo.studyInstanceUID ?? undefined };
            setCursor3DActive(prev => !prev);
         }
         try { cornerstone.updateImage(element); } catch(err) {}
         return;
      }
      
      if (activeTool === 'roi') {
        const incompleteRoi = measurements.find(m => m.imageId === imageId && m.type === 'roi' && !m.isClosed);
        if (incompleteRoi) {
          const firstPt = incompleteRoi.points![0];
          const dist = Math.hypot(firstPt.x - imagePt.x, firstPt.y - imagePt.y);
          if (dist < threshold && incompleteRoi.points!.length > 2) {
             setMeasurements(prev => prev.map(m => m.id === incompleteRoi.id ? { ...m, isClosed: true } : m));
          } else {
             setMeasurements(prev => prev.map(m => m.id === incompleteRoi.id ? { ...m, points: [...m.points!, { ...imagePt }] } : m));
          }
          try { cornerstone.updateImage(element); } catch(err) {}
          return;
        }
      }
      
      let hit = false;
      
      for (const m of measurements) {
        if (m.imageId !== imageId) continue;
        
        // check second line first if it's an angle
        if (m.type === 'angle' && m.start2 && m.end2) {
          const distStart2 = Math.hypot(m.start2.x - imagePt.x, m.start2.y - imagePt.y);
          const distEnd2 = Math.hypot(m.end2.x - imagePt.x, m.end2.y - imagePt.y);
          if (distStart2 < threshold) {
            setDraggingPoint({ id: m.id, point: 'start2', isNew: false }); hit = true; break;
          } else if (distEnd2 < threshold) {
            setDraggingPoint({ id: m.id, point: 'end2', isNew: false }); hit = true; break;
          } else {
            const L2 = Math.pow(m.end2.x - m.start2.x, 2) + Math.pow(m.end2.y - m.start2.y, 2);
            if (L2 !== 0) {
              let t = ((imagePt.x - m.start2.x) * (m.end2.x - m.start2.x) + (imagePt.y - m.start2.y) * (m.end2.y - m.start2.y)) / L2;
              t = Math.max(0, Math.min(1, t));
              const projection = { x: m.start2.x + t * (m.end2.x - m.start2.x), y: m.start2.y + t * (m.end2.y - m.start2.y) };
              if (Math.hypot(imagePt.x - projection.x, imagePt.y - projection.y) < threshold) {
                setDraggingPoint({ id: m.id, point: 'line2', isNew: false, lastPt: imagePt });
                hit = true; break;
              }
            }
          }
        } else if (m.type === 'roi' && m.points && m.isClosed) {
          let roiPtHit = false;
          for (let pi = 0; pi < m.points.length; pi++) {
            const p = m.points[pi];
            if (Math.hypot(p.x - imagePt.x, p.y - imagePt.y) < threshold) {
              setDraggingPoint({ id: m.id, point: `point_${pi}`, isNew: false });
              hit = true;
              roiPtHit = true;
              break;
            }
          }
          if (roiPtHit) break;

          let inside = false;
          for (let i = 0, j = m.points.length - 1; i < m.points.length; j = i++) {
            const xi = m.points[i].x, yi = m.points[i].y;
            const xj = m.points[j].x, yj = m.points[j].y;
            const intersect = ((yi > imagePt.y) !== (yj > imagePt.y)) && (imagePt.x < (xj - xi) * (imagePt.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }
          if (inside) {
            setDraggingPoint({ id: m.id, point: 'line', isNew: false, lastPt: imagePt });
            hit = true;
            break;
          }
        }
        
        if (m.type !== 'roi') {
          const distStart = Math.hypot(m.start.x - imagePt.x, m.start.y - imagePt.y);
          const distEnd = Math.hypot(m.end.x - imagePt.x, m.end.y - imagePt.y);
          if (distStart < threshold) {
            setDraggingPoint({ id: m.id, point: 'start', isNew: false }); hit = true; break;
          } else if (distEnd < threshold) {
            setDraggingPoint({ id: m.id, point: 'end', isNew: false }); hit = true; break;
          } else {
            const L2 = Math.pow(m.end.x - m.start.x, 2) + Math.pow(m.end.y - m.start.y, 2);
            if (L2 !== 0) {
              let t = ((imagePt.x - m.start.x) * (m.end.x - m.start.x) + (imagePt.y - m.start.y) * (m.end.y - m.start.y)) / L2;
              t = Math.max(0, Math.min(1, t));
              const projection = { x: m.start.x + t * (m.end.x - m.start.x), y: m.start.y + t * (m.end.y - m.start.y) };
              if (Math.hypot(imagePt.x - projection.x, imagePt.y - projection.y) < threshold) {
                setDraggingPoint({ id: m.id, point: 'line', isNew: false, lastPt: imagePt });
                hit = true; break;
              }
            }
          }
        }
      }
      
      if (!hit && (activeTool === 'length' || activeTool === 'angle' || activeTool === 'roi')) {
        const incompleteAngle = measurements.find(m => m.imageId === imageId && m.type === 'angle' && activeTool === 'angle' && (!m.start2 || !m.end2));
        if (incompleteAngle) {
           setMeasurements(prev => prev.map(m => m.id === incompleteAngle.id ? { ...m, start2: {...imagePt}, end2: {...imagePt}, type: 'angle' } : m));
           setDraggingPoint({ id: incompleteAngle.id, point: 'end2', isNew: true });
        } else {
           const newId = String(measurementIdCounter++);
           if (activeTool === 'roi') {
              const newMeasurement = {
                id: newId, imageId, type: 'roi' as any,
                start: { ...imagePt }, end: { ...imagePt }, // unused for ROI but required by type
                points: [{ ...imagePt }],
                isClosed: false
              };
              setMeasurements(prev => [...prev, newMeasurement]);
           } else {
              const newMeasurement = {
                id: newId,
                imageId,
                type: activeTool as any,
                start: { ...imagePt },
                end: { ...imagePt }
              };
              setMeasurements(prev => [...prev, newMeasurement]);
              setDraggingPoint({ id: newId, point: 'end', isNew: true });
           }
        }
      }
    }
  };

  const handlePointerMove = async (e: React.PointerEvent, viewportIndex: number) => {
    const element = viewportRefs.current[viewportIndex];
    if (!element) return;
    const cs = await import('cornerstone-core');
    const cornerstone = cs.default || cs;
    let enabledElement;
    try { enabledElement = cornerstone.getEnabledElement(element); } catch(err) { return; }
    if (!enabledElement) return;

    mousePosRef.current = { x: e.pageX, y: e.pageY };
    if (e.buttons === 0) {
      if (activeTool === 'pixel' || measurements.some(m => m.imageId === enabledElement.image?.imageId)) {
        try { cornerstone.updateImage(element); } catch(err) {}
      }
      return;
    }

    let viewport;
    try {
      viewport = cornerstone.getViewport(element);
    } catch (err) {
      return;
    }
    if (!viewport) return;

    let action = null;
    if (e.buttons === 3) { // Left + Right
      action = 'zoom';
    } else if (e.buttons === 4) { // Middle
      action = 'pan';
    } else if (e.buttons === 2) { // Right
      action = 'wwc';
    } else if (e.buttons === 1) { // Left
      if (draggingPoint) {
        action = 'drag_measurement';
      } else {
        action = activeTool;
      }
    }

    if (action && (e.movementX !== 0 || e.movementY !== 0)) {
       lastMultiButtonInteraction.current = window.performance.now();
       isPointerDraggingRef.current = true;
    }

    if (action === 'wwc') {
      const multiplier = Math.max(viewport.voi.windowWidth / 256, 1);
      viewport.voi.windowCenter += (e.movementY * multiplier);
      viewport.voi.windowWidth -= (e.movementX * multiplier);
      if (viewport.voi.windowWidth < 1) viewport.voi.windowWidth = 1;
      cornerstone.setViewport(element, viewport);
    } else if (action === 'pan') {
      viewport.translation.x += (e.movementX / viewport.scale);
      viewport.translation.y += (e.movementY / viewport.scale);
      cornerstone.setViewport(element, viewport);
    } else if (action === 'zoom') {
      const oldScale = viewport.scale;
      const zoomFactor = Math.pow(1.02, -e.movementY); 
      let minScale = 0.1;
      const maxScale = 10.0;
      
      try {
         const enabledElement = cornerstone.getEnabledElement(element);
         if (enabledElement && enabledElement.image) {
            const imgWidth = enabledElement.image.columns;
            const imgHeight = enabledElement.image.rows;
            if (imgWidth > 0 && imgHeight > 0) {
               const fitScale = Math.min(element.clientWidth / imgWidth, element.clientHeight / imgHeight);
               minScale = 0.5 * fitScale;
            }
         }
      } catch (err) {}
      
      const newScale = Math.max(minScale, Math.min(maxScale, oldScale * zoomFactor));
      
      if (newScale !== oldScale) {
         viewport.scale = newScale;
         
         const rect = element.getBoundingClientRect();
         const canvasX = e.clientX - rect.left;
         const canvasY = e.clientY - rect.top;
         const centerX = rect.width / 2;
         const centerY = rect.height / 2;
         
         viewport.translation.x += (canvasX - centerX) * (1 / newScale - 1 / oldScale);
         viewport.translation.y += (canvasY - centerY) * (1 / newScale - 1 / oldScale);
         
         cornerstone.setViewport(element, viewport);
      }
    } else if (action === 'pixel') {
      const imagePt = cornerstone.pageToPixel(element, e.pageX, e.pageY) as any;
      const vpInfo = viewports[viewportIndex];
      const study = studies.find(s => s.studyInstanceUID === vpInfo.studyInstanceUID);
      const series = study?.series.find(s => s.seriesInstanceUID === vpInfo.seriesInstanceUID);
      const instance = series?.instances[vpInfo.imageIndex];
      
      if (instance && instance.metadata.imagePositionPatient && instance.metadata.imageOrientationPatient && instance.metadata.pixelSpacing) {
         const S = instance.metadata.imagePositionPatient;
         const X = instance.metadata.imageOrientationPatient.slice(0, 3);
         const Y = instance.metadata.imageOrientationPatient.slice(3, 6);
         const px = instance.metadata.pixelSpacing[1]; // column spacing (x)
         const py = instance.metadata.pixelSpacing[0]; // row spacing (y)
         
         const P_world = addVectors(
            S,
            addVectors(
               scaleVector(X, imagePt.x * px),
               scaleVector(Y, imagePt.y * py)
            )
         );
         
         cursor3DRef.current = { point: P_world, sourceViewportIndex: viewportIndex, studyInstanceUID: vpInfo.studyInstanceUID ?? undefined };
         setCursor3DActive(prev => !prev);
      }
      try { cornerstone.updateImage(element); } catch(err) {}
    } else if (action === 'drag_measurement' || action === 'length' || action === 'angle' || action === 'roi') {
      if (!draggingPoint) return;
      
      let imagePt = cornerstone.pageToPixel(element, e.pageX, e.pageY) as any;
      
      if (e.shiftKey) {
        const m = measurements.find(m => m.id === draggingPoint.id);
        if (m && (m.type === 'length' || m.type === 'angle')) {
          let refPt = null;
          if (draggingPoint.point === 'end') refPt = m.start;
          else if (draggingPoint.point === 'start') refPt = m.end;
          else if (draggingPoint.point === 'end2') refPt = m.start2;
          else if (draggingPoint.point === 'start2') refPt = m.end2;
          
          if (refPt) {
            const dx = Math.abs(imagePt.x - refPt.x);
            const dy = Math.abs(imagePt.y - refPt.y);
            if (dx > dy) {
              imagePt.y = refPt.y;
            } else {
              imagePt.x = refPt.x;
            }
          }
        }
      }
      
      let hoverTrash = false;
      try {
        const elementsUnderPointer = document.elementsFromPoint(e.clientX, e.clientY);
        if (elementsUnderPointer.some(el => el.id === 'trash-icon' || el.closest('#trash-icon'))) {
          hoverTrash = true;
        }
      } catch(err) {}
      setIsDraggingOverTrash(hoverTrash);

      if (draggingPoint.point === 'line' || draggingPoint.point === 'line2') {
        const dx = imagePt.x - draggingPoint.lastPt.x;
        const dy = imagePt.y - draggingPoint.lastPt.y;
        setMeasurements(prev => prev.map(m => {
          if (m.id === draggingPoint.id) {
            if (m.type === 'roi' && m.points) {
              return {
                ...m,
                points: m.points.map(pt => ({ x: pt.x + dx, y: pt.y + dy }))
              };
            }
            const isAngle = m.type === 'angle';
            if (isAngle && m.start2 && m.end2) {
              return {
                ...m,
                start: {x: m.start.x + dx, y: m.start.y + dy},
                end: {x: m.end.x + dx, y: m.end.y + dy},
                start2: {x: m.start2.x + dx, y: m.start2.y + dy},
                end2: {x: m.end2.x + dx, y: m.end2.y + dy}
              };
            } else if (draggingPoint.point === 'line') {
              return { ...m, start: {x: m.start.x + dx, y: m.start.y + dy}, end: {x: m.end.x + dx, y: m.end.y + dy} };
            } else if (draggingPoint.point === 'line2' && m.start2 && m.end2) {
              return { ...m, start2: {x: m.start2.x + dx, y: m.start2.y + dy}, end2: {x: m.end2.x + dx, y: m.end2.y + dy} };
            }
          }
          return m;
        }));
        setDraggingPoint(prev => prev ? { ...prev, lastPt: imagePt } : null);
      } else if (draggingPoint.point.startsWith('point_')) {
        const ptIdx = parseInt(draggingPoint.point.replace('point_', ''), 10);
        setMeasurements(prev => prev.map(m => {
          if (m.id === draggingPoint.id && m.points) {
            return {
              ...m,
              points: m.points.map((pt, idx) => idx === ptIdx ? { ...imagePt } : pt)
            };
          }
          return m;
        }));
      } else {
        setMeasurements(prev => prev.map(m => 
          m.id === draggingPoint.id 
            ? { ...m, [draggingPoint.point]: imagePt }
            : m
        ));
      }
      try { cornerstone.updateImage(element); } catch(err) {}
    }
  };

  const handlePointerUp = (e: React.PointerEvent, viewportIndex: number) => {
    const target = e.currentTarget;
    const pointerId = e.pointerId;
    const clientX = e.clientX;
    const clientY = e.clientY;
    
    try {
      target.releasePointerCapture(pointerId);
    } catch(err) {}
    
    if (cursor3DRef.current && activeTool === 'pixel') {
       cursor3DRef.current = null;
       setCursor3DActive(prev => !prev);
    }
    
    if (draggingPoint) {
      let isDroppedOnTrash = false;
      try {
        const elementsUnderPointer = document.elementsFromPoint(clientX, clientY);
        if (elementsUnderPointer.some(el => el.id === 'trash-icon' || el.closest('#trash-icon'))) {
          isDroppedOnTrash = true;
        }
      } catch(err) {}

      if (isDroppedOnTrash) {
        setMeasurements(prev => prev.filter(m => m.id !== draggingPoint.id));
      } else if (draggingPoint.isNew) {
        if (draggingPoint.point === 'end2') {
          setMeasurements(prev => prev.map(m => {
            if (m.id === draggingPoint.id) {
              const dist = Math.hypot(m.start2!.x - m.end2!.x, m.start2!.y - m.end2!.y);
              if (dist <= 1) {
                return { ...m, start2: undefined, end2: undefined };
              }
            }
            return m;
          }));
        } else {
          setMeasurements(prev => prev.filter(m => {
            if (m.id === draggingPoint.id) {
              const dist = Math.hypot(m.start.x - m.end.x, m.start.y - m.end.y);
              return dist > 1;
            }
            return true;
          }));
        }
      }
      setDraggingPoint(null);
      setIsDraggingOverTrash(false);
      
      const element = viewportRefs.current[viewportIndex];
      if (element) {
        import('cornerstone-core').then(cs => {
           const cornerstone = cs.default || cs;
           try { cornerstone.updateImage(element); } catch(err){}
        });
      }
    }
  };

  // Handle wheel scrolling for images

  const syncScrollToImage = (sourceViewportIndex: number, newImageIndex: number) => {
    const vp = viewports[sourceViewportIndex];
    const study = studies.find(s => s.studyInstanceUID === vp.studyInstanceUID);
    const series = study?.series.find(s => s.seriesInstanceUID === vp.seriesInstanceUID);
    if (!series) return;

    const updates: {vpIdx: number, newIdx: number, instance: any}[] = [];
    updates.push({vpIdx: sourceViewportIndex, newIdx: newImageIndex, instance: series.instances[newImageIndex]});

    const sourceInstance = series.instances[newImageIndex];
    const sourceS = sourceInstance?.metadata.imagePositionPatient;
    const sourceOrientation = sourceInstance?.metadata.imageOrientationPatient;

    if (sourceS && sourceOrientation) {
      const sourceNormal = getNormal(sourceOrientation);

      viewports.forEach((otherVp, i) => {
        if (i === sourceViewportIndex || !otherVp.seriesInstanceUID || otherVp.studyInstanceUID !== vp.studyInstanceUID) return;
        const otherStudy = studies.find(s => s.studyInstanceUID === otherVp.studyInstanceUID);
        const otherSeries = otherStudy?.series.find(s => s.seriesInstanceUID === otherVp.seriesInstanceUID);
        if (!otherSeries) return;

        const targetInstanceForNormal = otherSeries.instances[otherVp.imageIndex];
        if (!targetInstanceForNormal?.metadata.imageOrientationPatient) return;
        
        const targetNormal = getNormal(targetInstanceForNormal.metadata.imageOrientationPatient);
        const dot = Math.abs(dotProduct(sourceNormal, targetNormal));
        if (dot > 0.99) { // Parallel
           let minDistance = Infinity;
           let bestIndex = -1;
           otherSeries.instances.forEach((inst, idx) => {
              if (!inst.metadata.imagePositionPatient) return;
              const d = Math.abs(dotProduct(subVectors(inst.metadata.imagePositionPatient, sourceS), sourceNormal));
              if (d < minDistance) {
                 minDistance = d;
                 bestIndex = idx;
              }
           });
           if (bestIndex !== -1 && bestIndex !== otherVp.imageIndex) {
              updates.push({vpIdx: i, newIdx: bestIndex, instance: otherSeries.instances[bestIndex]});
           }
        }
      });
    }

    setViewports(prev => {
      const next = [...prev];
      updates.forEach(u => {
        next[u.vpIdx] = { ...next[u.vpIdx], imageIndex: u.newIdx };
      });
      return next;
    });

    updates.forEach(u => {
      renderViewportImage(u.vpIdx, u.instance);
    });
    updateOtherViewports(sourceViewportIndex);
  };

  const handleWheel = (e: React.WheelEvent, viewportIndex: number) => {
    const vp = viewports[viewportIndex];
    if (!vp.seriesInstanceUID) return;

    const study = studies.find(s => s.studyInstanceUID === vp.studyInstanceUID);
    const series = study?.series.find(s => s.seriesInstanceUID === vp.seriesInstanceUID);
    if (!series || series.instances.length <= 1) return;

    const now = window.performance.now();
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

  useEffect(() => {
    // When layout changes, we need to re-render all visible viewports
    // to ensure Cornerstone canvases are properly sized and drawn
    setTimeout(() => {
       for (let i = 0; i < layout; i++) {
          const vp = viewports[i];
          if (vp && vp.seriesInstanceUID) {
             const study = studies.find(s => s.studyInstanceUID === vp.studyInstanceUID);
             const series = study?.series.find(s => s.seriesInstanceUID === vp.seriesInstanceUID);
             if (series && series.instances[vp.imageIndex]) {
                renderViewportImage(i, series.instances[vp.imageIndex], true);
             }
          }
       }
    }, 50);
  }, [layout]);

  // Keyboard navigation for image slices (ArrowUp / ArrowDown / PageUp / PageDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in input or textarea
      const target = e.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName?.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
          return;
        }
      }

      if (e.key === 'Escape') {
        setActiveTool('none');
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp') {
        const targetVpIndex = maximizedIndex !== null ? maximizedIndex : (activeViewportIndex !== null ? activeViewportIndex : 0);
        if (targetVpIndex === null || targetVpIndex < 0 || targetVpIndex >= viewports.length) return;
        const vp = viewports[targetVpIndex];
        if (!vp || !vp.seriesInstanceUID) return;

        const study = studies.find(s => s.studyInstanceUID === vp.studyInstanceUID);
        const series = study?.series.find(s => s.seriesInstanceUID === vp.seriesInstanceUID);
        if (!series || series.instances.length <= 1) return;

        e.preventDefault();

        const step = (e.key === 'PageDown' || e.key === 'PageUp') ? 5 : 1;
        let newIndex = vp.imageIndex;
        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          newIndex = Math.min(newIndex + step, series.instances.length - 1);
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          newIndex = Math.max(newIndex - step, 0);
        }

        if (newIndex !== vp.imageIndex) {
          syncScrollToImage(targetVpIndex, newIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeViewportIndex, maximizedIndex, viewports, studies]);

  // Load series into a specific viewport
  const loadSeriesIntoViewport = (viewportIndex: number, studyUID: string, seriesUID: string, currentStudies: DICOMStudy[] = studies) => {
    const study = currentStudies.find(s => s.studyInstanceUID === studyUID);
    const series = study?.series.find(s => s.seriesInstanceUID === seriesUID);
    const initialIndex = series ? Math.floor(series.instances.length / 2) : 0;

    setViewports(prev => {
      const next = [...prev];
      next[viewportIndex] = { studyInstanceUID: studyUID, seriesInstanceUID: seriesUID, imageIndex: initialIndex };
      return next;
    });
    
    if (series && series.instances.length > 0) {
      renderViewportImage(viewportIndex, series.instances[initialIndex], true);
    }
  };

  useEffect(() => {
    const initCornerstone = async () => {
      try {
        if (typeof window !== 'undefined') {
          // Dynamic imports for client-side only libraries
          const cs = await import('cornerstone-core');
          const dp = await import('dicom-parser');
          const csLoader = await import('cornerstone-wado-image-loader');
          
          const cornerstone = cs.default || cs;
          const dicomParser = dp.default || dp;
          const cornerstoneWADOImageLoader = csLoader.default || csLoader;

          cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
          cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
          
          cornerstoneWADOImageLoader.webWorkerManager.initialize({
            maxWebWorkers: Math.max(navigator.hardwareConcurrency - 1, 1),
            startWebWorkersOnDemand: true,
            taskConfiguration: {
              decodeTask: {
                initializeCodecsOnStartup: false,
                usePDFJS: false,
                strict: false,
              },
            },
          });
        }
      } catch (err) {
        console.error("Failed to initialize Cornerstone.js", err);
      }
    };
    initCornerstone();
  }, []);

  const tools = [
    { id: 'wwc', icon: SunMedium, label: 'Window/Level (WW/WL)', shortcut: 'Right Click' },
    { id: 'pan', icon: Move, label: 'Pan', shortcut: 'Middle Click' },
    { id: 'zoom', icon: Search, label: 'Zoom', shortcut: 'Left + Right Click' },
    { id: 'length', icon: Ruler, label: 'Distance', shortcut: '' },
    { id: 'angle', icon: AngleIcon, label: 'Angle', shortcut: '' },
    { id: 'roi', icon: RoiIcon, label: 'ROI (Polygon)', shortcut: '' },
    { id: 'pixel', icon: Crosshair, label: 'Pixel Probe', shortcut: '' },
  ] as const;

  const handleSaveReport = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const now = new Date();
    const fullReportText = generateReportText({
      studies,
      findings: reportText,
      timestamp: now,
    });
    const filename = generateReportFilename(studies, now);
    const success = downloadReportFile(fullReportText, filename);

    if (success) {
      setReportSavedStatus(true);
      setTimeout(() => {
        setReportSavedStatus(false);
      }, 3000);
    }
  };

  const handleCopyReport = () => {
    const fullReportText = generateReportText({
      studies,
      findings: reportText,
      timestamp: new Date(),
    });
    navigator.clipboard.writeText(fullReportText).then(() => {
      setIsReportCopied(true);
      setTimeout(() => {
        setIsReportCopied(false);
      }, 2500);
    }).catch(err => {
      console.error('Failed to copy report to clipboard', err);
    });
  };

  const getGridClasses = (currentLayout: Layout) => {
    switch (currentLayout) {
      case 2:
        return 'grid-cols-2 grid-rows-1';
      case 4:
        return 'grid-cols-2 grid-rows-2';
      case 1:
      default:
        return 'grid-cols-1 grid-rows-1';
    }
  };

  // File handling functions
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processDataTransfer = async (dataTransfer: DataTransfer, isReplace: boolean = false) => {
    if (dataTransfer.items) {
      const items = Array.from(dataTransfer.items);
      const filePromises = items.map(item => {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          return traverseFileTree(entry);
        } else if (item.kind === 'file') {
          const file = item.getAsFile();
          return file ? Promise.resolve([file]) : Promise.resolve([]);
        }
        return Promise.resolve([]);
      });
      
      const filesArrays = await Promise.all(filePromises);
      const allFiles = filesArrays.flat().filter(f => f.name !== '.DS_Store' && !f.name.startsWith('._'));
      
      if (allFiles.length > 0) {
        handleFiles(allFiles, isReplace);
      }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      handleFiles(Array.from(dataTransfer.files), isReplace);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    processDataTransfer(e.dataTransfer);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files).filter(f => f.name !== '.DS_Store' && !f.name.startsWith('._'));
      if (allFiles.length > 0) {
        handleFiles(allFiles);
      }
    }
  };


  const clearAllViewports = async () => {
    try {
        const cs = await import('cornerstone-core');
        const cornerstone = cs.default || cs;
        viewportRefs.current.forEach((el) => {
            if (el) {
                try {
                    cornerstone.disable(el);
                    cornerstone.enable(el);
                } catch(err) {}
            }
        });
    } catch (err) {}
  };

  const applyValidInstances = (instances: DICOMInstance[], clearPrevious: boolean) => {
    let firstStudyUID: string | null = null;
    let firstSeriesUID: string | null = null;

    setStudies((prevStudies) => {
      const nextStudies = clearPrevious ? [] : prevStudies.map(s => ({
          ...s,
          series: s.series.map(ser => ({ ...ser, instances: [...ser.instances] }))
      }));

      instances.forEach((instance) => {
        const { 
          studyInstanceUID, 
          patientName, 
          patientId, 
          patientBirthDate,
          patientSex,
          patientAge,
          studyDate, 
          studyTime,
          studyDescription,
          accessionNumber,
          referringPhysician,
          institutionName,
          seriesInstanceUID, 
          seriesDescription, 
          modality 
        } = instance.metadata;
        let study = nextStudies.find((s) => s.studyInstanceUID === studyInstanceUID);

        if (!study) {
          study = { 
            studyInstanceUID, 
            patientName, 
            patientId, 
            patientBirthDate,
            patientSex,
            patientAge,
            studyDate, 
            studyTime,
            studyDescription,
            accessionNumber,
            referringPhysician,
            institutionName,
            series: [] 
          };
          nextStudies.push(study);
        } else {
          if (!study.studyDescription && studyDescription) study.studyDescription = studyDescription;
          if (!study.studyTime && studyTime) study.studyTime = studyTime;
          if (!study.accessionNumber && accessionNumber) study.accessionNumber = accessionNumber;
          if (!study.patientBirthDate && patientBirthDate) study.patientBirthDate = patientBirthDate;
          if (!study.patientSex && patientSex) study.patientSex = patientSex;
          if (!study.patientAge && patientAge) study.patientAge = patientAge;
          if (!study.referringPhysician && referringPhysician) study.referringPhysician = referringPhysician;
          if (!study.institutionName && institutionName) study.institutionName = institutionName;
        }

        let series = study.series.find((s) => s.seriesInstanceUID === seriesInstanceUID);
        if (!series) {
          series = { seriesInstanceUID, seriesDescription, modality, instances: [] };
          study.series.push(series);
        }

        if (!series.instances.some((inst) => inst.imageId === instance.imageId)) {
           series.instances.push(instance);
        }
        
        if (!firstStudyUID) {
           firstStudyUID = studyInstanceUID;
           firstSeriesUID = seriesInstanceUID;
        }
      });

      nextStudies.forEach((study) => {
        study.series.forEach((series) => {
          if (series.instances.length > 1) {
            const iop = series.instances[0].metadata.imageOrientationPatient;
            if (iop && iop.length >= 6) {
              const row = iop.slice(0, 3);
              const col = iop.slice(3, 6);
              const N = cross(row, col);
              
              const absX = Math.abs(N[0]);
              const absY = Math.abs(N[1]);
              const absZ = Math.abs(N[2]);
              const max = Math.max(absX, absY, absZ);
              
              let sortVector = [...N];
              if (max === absZ) {
                if (N[2] > 0) sortVector = [-N[0], -N[1], -N[2]];
              } else if (max === absX) {
                if (N[0] < 0) sortVector = [-N[0], -N[1], -N[2]];
              } else if (max === absY) {
                if (N[1] < 0) sortVector = [-N[0], -N[1], -N[2]];
              }

              series.instances.sort((a, b) => {
                const ippA = a.metadata.imagePositionPatient;
                const ippB = b.metadata.imagePositionPatient;
                if (ippA && ippB) {
                  const distA = dot(ippA, sortVector);
                  const distB = dot(ippB, sortVector);
                  return distA - distB;
                }
                return (a.metadata.instanceNumber || 0) - (b.metadata.instanceNumber || 0);
              });
            } else {
              series.instances.sort((a, b) => (a.metadata.instanceNumber || 0) - (b.metadata.instanceNumber || 0));
            }
          }
        });
      });

      return nextStudies;
    });

    setStudies(currentStudies => {
        const flatSeries: {studyUID: string, seriesUID: string}[] = [];
        currentStudies.forEach(study => {
           study.series.forEach(series => {
              flatSeries.push({ studyUID: study.studyInstanceUID, seriesUID: series.seriesInstanceUID });
           });
        });

        let newLayout: Layout = 1;
        if (flatSeries.length === 2) newLayout = 2;
        else if (flatSeries.length >= 3) newLayout = 4;
        
        setTimeout(() => {
           if (clearPrevious) {
               clearAllViewports();
               setMeasurements([]);
               setActiveTool('none');
               setIsSidebarOpen(false);
           }
           setLayout(newLayout);
           setViewports(prev => {
              const nextViewports = clearPrevious ? prev.map(vp => ({ ...vp, seriesInstanceUID: null, currentImageIndex: 0 })) : [...prev];
              const loadsToPerform: {index: number, studyUID: string, seriesUID: string}[] = [];
              for (let i = 0; i < 4; i++) {
                 if (flatSeries[i] && !nextViewports[i].seriesInstanceUID) {
                    loadsToPerform.push({ index: i, studyUID: flatSeries[i].studyUID, seriesUID: flatSeries[i].seriesUID });
                 }
              }

              if (loadsToPerform.length > 0) {
                 setTimeout(() => {
                    loadsToPerform.forEach(load => {
                       loadSeriesIntoViewport(load.index, load.studyUID, load.seriesUID, currentStudies);
                    });
                 }, 50);
              }
              
              return nextViewports;
           });
        }, 0);
        
        return currentStudies;
    });
  };

  const handleFiles = async (files: File[], isReplace: boolean = false) => {
    if (files.length === 0) return;

    setIsParsing(true);
    
    setTimeout(async () => {
      try {
        const csLoader = await import('cornerstone-wado-image-loader');
        const cornerstoneWADOImageLoader = csLoader.default || csLoader;

        const results = await Promise.all(
        files.map(
          (file) =>
            new Promise<any>(async (resolve) => {
              try {
                const buffer = await file.arrayBuffer();
                const worker = new Worker(new URL('./workers/dicom.worker.ts', import.meta.url));
                
                worker.onmessage = async (e) => {
                  const { success, isImage, metadata, buffer: returnedBuffer, error } = e.data;
                  worker.terminate();
                  if (success) {
                    if (isImage === false) {
                       resolve({ _skip: true });
                       return;
                    }
                    const newFile = new File([returnedBuffer], file.name, { type: file.type || 'application/dicom' });
                    const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(newFile);
                    resolve({ file: newFile, imageId, metadata });
                  } else {
                    let userFriendlyError = error;
                    if (typeof error === 'string' && error.includes('DICM prefix not found')) {
                       userFriendlyError = 'Not a valid DICOM file (missing DICM prefix).';
                    } else if (error instanceof Error && error.message.includes('DICM prefix not found')) {
                       userFriendlyError = 'Not a valid DICOM file (missing DICM prefix).';
                    }
                    resolve({ _isError: true, fileName: file.name, error: userFriendlyError });
                  }
                };
                worker.postMessage({ buffer, fileName: file.name }, [buffer]);
              } catch (err: any) {
                console.error("Error processing file:", err);
                resolve({ _isError: true, fileName: file.name, error: err.message || 'Unknown error' });
              }
            })
        )
      );

      const errors = results.filter((r) => r && r._isError);
      if (errors.length > 0) {
         const msgs = errors.map((e: React.MouseEvent | React.ChangeEvent | any) => `- ${e.fileName}: ${e.error}`).join('\n');
         setErrorMessage(`Failed to parse some files:\n\n${msgs}`);
      }

      const validInstances = results.filter((r) => r && !r._isError && !r._skip) as DICOMInstance[];
      if (validInstances.length === 0) return;

      let mismatch = false;
      // We can use studies from closure, but since this is inside a setTimeout we must be careful.
      // However, it's better to just use the closure's studies as it captures the render state.
      const existingPatientIds = new Set(studies.map(s => s.patientId));
      const newPatientIds = new Set(validInstances.map(inst => inst.metadata.patientId));
      if (existingPatientIds.size > 0) {
        for (const newId of newPatientIds) {
          if (!existingPatientIds.has(newId)) {
            mismatch = true;
            break;
          }
        }
      }

      if (isReplace) {
        applyValidInstances(validInstances, true);
      } else {
        if (mismatch) {
          setIsParsing(false);
          setPatientMismatchDialog({ show: true, pendingInstances: validInstances });
          return;
        }
        applyValidInstances(validInstances, false);
      }
      
      } catch (err) {
        console.error("Error processing batch via worker:", err);
      } finally {
        setIsParsing(false);
      }
    }, 50);
  };

  const handleConfirmMismatchDialog = (clearPrevious: boolean) => {
    const instances = patientMismatchDialog.pendingInstances;
    setPatientMismatchDialog({ show: false, pendingInstances: [] });
    setIsParsing(true); // show spinner while inserting
    
    setTimeout(() => {
        try {
            applyValidInstances(instances, clearPrevious);
        } finally {
            setIsParsing(false);
        }
    }, 50);
  };

  const handleRemoveAll = () => {
    setStudies([]);
    clearAllViewports();
    setViewports(prev => prev.map(vp => ({ ...vp, seriesInstanceUID: null, studyInstanceUID: null, currentImageIndex: 0 })));
    setLayout(1);
    setMeasurements([]);
    setActiveTool('none');
    setIsSidebarOpen(false);
    if (cursor3DRef.current) cursor3DRef.current = null;
    setCursor3DActive(false);
    setShowRemoveAllDialog(false);
  };

  const handleRootDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setShowGlobalOverlay(true);
    }
  };

  return (
    <div 
      className="flex h-screen bg-neutral-950 text-neutral-300 font-sans overflow-hidden select-none"
      onDragEnter={handleRootDragEnter}
    >
      
      {/* Global Drag Overlay */}
      {showGlobalOverlay && (
        <div
          className="fixed inset-0 z-[100] flex"
          onDragLeave={(e) => {
            if (!e.relatedTarget || (e.relatedTarget as Element).nodeName === 'HTML') {
              setShowGlobalOverlay(false);
              setOverlayHoverZone('none');
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (studies.length === 0) {
              setOverlayHoverZone('single');
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              if (e.clientX < rect.width / 2) {
                setOverlayHoverZone('left');
              } else {
                setOverlayHoverZone('right');
              }
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setShowGlobalOverlay(false);
            const isReplace = studies.length > 0 && overlayHoverZone === 'right';
            setOverlayHoverZone('none');
            processDataTransfer(e.dataTransfer, isReplace);
          }}
        >
          {studies.length === 0 ? (
            <div className={`flex-1 flex flex-col items-center justify-center bg-blue-900/40 backdrop-blur-sm border-4 border-dashed transition-colors ${overlayHoverZone === 'single' ? 'border-blue-400' : 'border-blue-500/50'}`}>
              <div className="pointer-events-none text-center">
                <UploadCloud className="w-20 h-20 text-blue-400 mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-white mb-2">Drop images here</h2>
                <p className="text-blue-200">Load DICOM files or folders</p>
              </div>
            </div>
          ) : (
            <>
              <div className={`flex-1 flex flex-col items-center justify-center backdrop-blur-sm border-4 border-dashed transition-colors ${overlayHoverZone === 'left' ? 'bg-blue-900/60 border-blue-400' : 'bg-blue-950/40 border-blue-500/30'} border-r-0`}>
                <div className="pointer-events-none text-center">
                  <Plus className="w-20 h-20 text-blue-400 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-white mb-2">ADD IMAGES</h2>
                  <p className="text-blue-200">Keep current studies and append new ones</p>
                </div>
              </div>
              <div className={`flex-1 flex flex-col items-center justify-center backdrop-blur-sm border-4 border-dashed transition-colors ${overlayHoverZone === 'right' ? 'bg-orange-900/60 border-orange-400' : 'bg-orange-950/40 border-orange-500/30'} border-l-0`}>
                <div className="pointer-events-none text-center">
                  <RefreshCw className="w-20 h-20 text-orange-400 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold text-white mb-2">REPLACE IMAGES</h2>
                  <p className="text-orange-200">Clear current studies and load only new ones</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Error Message Modal */}
      {errorMessage && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-red-900/50 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-800 flex items-center gap-3 bg-red-950/20">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Parse Error</h2>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <pre className="text-xs text-neutral-300 whitespace-pre-wrap font-mono">
                {errorMessage}
              </pre>
            </div>
            <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex justify-end">
              <button 
                onClick={() => setErrorMessage(null)}
                className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Mismatch Dialog */}
      {patientMismatchDialog.show && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="p-5 border-b border-neutral-800 flex items-center gap-3 bg-neutral-900">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Patient ID Mismatch</h2>
                <p className="text-sm text-neutral-400">The new images have a different Patient ID than the currently loaded images.</p>
              </div>
            </div>
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
              <button
                onClick={() => setPatientMismatchDialog({ show: false, pendingInstances: [] })}
                className="w-full px-4 py-3 bg-transparent hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium rounded-lg transition-colors flex items-center justify-center mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove All Dialog Modal */}
      {showRemoveAllDialog && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="p-5 border-b border-neutral-800 flex items-center gap-3 bg-neutral-900">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Remove All Studies</h2>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <p className="text-sm text-neutral-300 mb-2">
                Are you sure you want to remove all loaded studies? This action cannot be undone.
              </p>
              <button
                onClick={handleRemoveAll}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg shadow transition-colors flex items-center justify-center"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowRemoveAllDialog(false)}
                className="w-full px-4 py-3 bg-transparent hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium rounded-lg transition-colors flex items-center justify-center mt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer Modal */}
      {isDisclaimerChecked && showDisclaimer && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
            <div className="p-6 border-b border-neutral-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Regulatory Disclaimer & Terms of Use</h2>
                <p className="text-sm text-neutral-400">Please read and accept before using this software.</p>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[50vh] text-sm text-neutral-300 space-y-4">
              <p className="font-semibold text-amber-400 uppercase tracking-wider text-xs">Not a Medical Device</p>
              <p>
                This software is intended for <strong>educational, research, and informational purposes only</strong>. It is <strong>NOT</strong> an FDA-approved or CE-marked medical device.
              </p>
              
              <p className="font-semibold text-amber-400 uppercase tracking-wider text-xs mt-4">No Diagnostic Use</p>
              <p>
                You must not use this software for clinical diagnosis, patient care, or primary image interpretation. The display quality, image scaling, and measurements provided by this tool have not been clinically validated and may contain inaccuracies.
              </p>
              
              <p className="font-semibold text-amber-400 uppercase tracking-wider text-xs mt-4">Data Privacy & Security</p>
              <p>
                This is a 100% client-side application. No images or patient data are uploaded to any server. However, you are solely responsible for ensuring that you have the appropriate permissions to view the data you load into this application and that your local environment is secure.
              </p>
              
              <p className="font-semibold text-amber-400 uppercase tracking-wider text-xs mt-4">Limitation of Liability</p>
              <p>
                The software is provided &quot;as is&quot;, without warranty of any kind. The authors and contributors shall not be held liable for any damages, clinical misinterpretations, or other liabilities arising from the use of this software.
              </p>
            </div>
            
            <div className="p-6 border-t border-neutral-800 bg-neutral-950 flex justify-end gap-3">
              <button 
                onClick={handleAcceptDisclaimer}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg shadow-lg transition-colors flex items-center gap-2"
              >
                I Understand and Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {isParsing && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-[#3584F5] animate-spin" />
            <div className="text-lg font-medium text-neutral-200">Parsing DICOM files...</div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {isHelpModalOpen && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsHelpModalOpen(false)}>
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#3584F5]/20 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5 text-[#3584F5]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Help & Shortcuts</h2>
                  <p className="text-sm text-neutral-400">Quick reference guide</p>
                </div>
              </div>
              <button 
                onClick={() => setIsHelpModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh] text-sm text-neutral-300 space-y-6">
              <div>
                <h3 className="font-semibold text-[#3584F5] uppercase tracking-wider text-xs mb-3 border-b border-neutral-800 pb-2">About</h3>
                <div className="flex items-center justify-between bg-neutral-950/50 p-4 rounded-lg border border-neutral-800/50">
                  <div className="flex items-center gap-3">
                    <span className="font-bold tracking-wide flex items-baseline select-none">
                      <span className="text-neutral-500 font-mono tracking-tighter text-lg">&lt;&nbsp;</span>
                      <span className="text-[#3584F5] font-mono text-lg">div.</span>
                      <span className="text-white text-xl ml-0.5">DICOM</span>
                      <span className="text-neutral-500 font-mono tracking-tighter ml-0.5 text-lg">&nbsp;/&gt;</span>
                    </span>
                    <span className="text-neutral-400 font-medium">v{currentVersion}</span>
                  </div>
                  <a href="https://github.com/jaaniin/div.DICOM/releases" target="_blank" rel="noopener noreferrer" className="text-sm text-[#3584F5] hover:text-[#3584F5] transition-colors">Release Notes</a>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-[#3584F5] uppercase tracking-wider text-xs mb-3 border-b border-neutral-800 pb-2">Mouse Controls</h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-neutral-400">Left Click & Drag</div><div className="font-medium text-white">Use Active Tool</div>
                  <div className="text-neutral-400">Middle Click & Drag</div><div className="font-medium text-white">Pan Image</div>
                  <div className="text-neutral-400">Right Click & Drag</div><div className="font-medium text-white">Adjust Window / Level</div>
                  <div className="text-neutral-400">Left + Right Click & Drag</div><div className="font-medium text-white">Zoom In / Out</div>
                  <div className="text-neutral-400">Scroll Wheel</div><div className="font-medium text-white">Change Slice</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-[#3584F5] uppercase tracking-wider text-xs mb-3 border-b border-neutral-800 pb-2">Keyboard Shortcuts</h3>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div className="text-neutral-400">Esc</div><div className="font-medium text-white">Drop active tool / Exit Zen Mode</div>
                  <div className="text-neutral-400">F11</div><div className="font-medium text-white">Browser Native Fullscreen</div>
                  <div className="text-neutral-400">Arrow Up / Down</div><div className="font-medium text-white">Next / Previous Slice</div>
                  <div className="text-neutral-400">Page Up / Down</div><div className="font-medium text-white">Skip 5 Slices</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-amber-400 uppercase tracking-wider text-xs mb-3 border-b border-neutral-800 pb-2">Medical Disclaimer</h3>
                <p className="text-neutral-400 text-sm leading-relaxed mb-2">
                  This software is intended for <strong>educational, research, and informational purposes only</strong>. It is <strong>NOT</strong> an FDA-approved or CE-marked medical device.
                </p>
                <p className="text-neutral-400 text-sm leading-relaxed mb-4">
                  Do not use this software for clinical diagnosis, patient care, or primary image interpretation. The display quality, image scaling, and measurements provided by this tool have not been clinically validated.
                </p>
              </div>
            </div>
            
            <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-between items-center gap-3">
              <div className="flex gap-2">
                <a 
                  href="https://github.com/jaaniin/div.DICOM" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Github className="w-4 h-4" />
                  View on GitHub
                </a>
                <a 
                  href="https://github.com/jaaniin/div.DICOM/issues" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  Report an Issue
                </a>
              </div>
              <button 
                onClick={() => setIsHelpModalOpen(false)}
                className="px-6 py-2 bg-[#3584F5] hover:bg-[#3584F5] text-white font-medium rounded-lg shadow-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Viewport Area */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-neutral-800">
        
        {/* Toolbar */}
        <div className="h-14 flex items-center justify-between px-4 bg-neutral-900 border-b border-neutral-800 flex-shrink-0 relative z-40">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wide mr-4 flex items-baseline select-none">
              <span className="text-neutral-500 font-mono tracking-tighter text-sm">&lt;&nbsp;</span>
              <span className="text-[#3584F5] font-mono text-sm">div.</span>
              <span className="text-white text-base ml-0.5">DICOM</span>
              <span className="text-neutral-500 font-mono tracking-tighter ml-0.5 text-sm">&nbsp;/&gt;</span>
            </span>
            {updateAvailable && (
              <a 
                href={updateAvailable.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-2 px-2 py-0.5 bg-[#3584F5]/20 text-[#3584F5] text-[10px] font-bold uppercase tracking-wider rounded border border-[#3584F5]/30 hover:bg-[#3584F5]/30 transition-colors flex items-center gap-1"
                title="New version available!"
              >
                Update: {updateAvailable.version}
              </a>
            )}
            <div className="w-px h-6 bg-neutral-700 mx-1" />
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(isActive ? 'none' : tool.id)}
                  className={`group relative p-2 rounded-md transition-colors ${
                    isActive 
                      ? 'bg-neutral-700 text-white' 
                      : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-500 whitespace-nowrap z-50 pointer-events-none border border-neutral-700/50 flex flex-col items-center leading-tight">
                    <span className="font-medium">{tool.label}</span>
                    {tool.shortcut && (
                      <span className="text-[10px] text-neutral-400 italic mt-0.5">{tool.shortcut}</span>
                    )}
                  </div>
                </button>
              );
            })}
            
            <div className="w-px h-6 bg-neutral-700 mx-1" />
            
            <div className="relative">
              <button 
                id="trash-icon"
                onClick={() => setIsTrashOpen(!isTrashOpen)}
                className={`group relative p-2 rounded-md transition-all duration-200 flex items-center justify-center ${
                  isDraggingOverTrash
                    ? 'scale-110 bg-red-600 text-white ring-2 ring-red-400 shadow-lg shadow-red-600/50'
                    : draggingPoint
                    ? 'scale-105 bg-neutral-800 text-neutral-200 border border-neutral-600 shadow-md animate-pulse'
                    : isTrashOpen
                    ? 'bg-neutral-700 text-white' 
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
              >
                {draggingPoint ? (
                  <Trash2 className={`w-5 h-5 transition-transform ${isDraggingOverTrash ? '-translate-y-0.5 scale-110 text-white' : 'text-neutral-300'}`} />
                ) : (
                  <ListCollapse className="w-5 h-5" />
                )}
                
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2.5 py-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-500 whitespace-nowrap z-50 pointer-events-none border border-neutral-700/50 flex flex-col items-center leading-tight">
                  <span className="font-medium">
                    {draggingPoint ? (isDraggingOverTrash ? "Release to delete measurement" : "Drag here to delete measurement") : "Measurements & Deletions"}
                  </span>
                </div>
              </button>
              
              {isTrashOpen && (
                <div className="absolute top-full left-0 mt-2 bg-neutral-800 border border-neutral-700 p-3 rounded-md shadow-2xl w-[340px] z-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Measurements</h4>
                    <span className="text-[10px] text-neutral-500">({measurements.length})</span>
                  </div>
                  {measurements.length === 0 ? (
                    <div className="text-xs text-neutral-500 italic mb-3">No measurements</div>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto mb-3">
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
                              <ChevronRight className={`w-4 h-4 text-neutral-400 transition-transform ${m.isExpanded ? 'rotate-90' : ''}`} />
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
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setMeasurements(prev => prev.filter(m => !selectedForDeletion.has(m.id)));
                      setSelectedForDeletion(new Set());
                      setIsTrashOpen(false);
                      import('cornerstone-core').then(cs => {
                        const cornerstone = cs.default || cs;
                        viewportRefs.current.forEach(el => {
                          if (el) { try { cornerstone.updateImage(el); } catch(err){} }
                        });
                      });
                    }}
                    disabled={selectedForDeletion.size === 0}
                    className="w-full py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-xs font-medium rounded transition-colors"
                  >
                    Delete selected {selectedForDeletion.size > 0 ? `(${selectedForDeletion.size})` : ''}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-l border-neutral-700 pl-4">
            <button 
              onClick={() => { 
                setLayout(1); 
                setMaximizedIndex(null); 
              }}
              className={`group relative p-2 rounded-md transition-colors ${layout === 1 ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}
            >
              <Square className="w-5 h-5" />
              <div className="absolute top-full right-0 mt-2 px-2.5 py-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-500 whitespace-nowrap z-50 pointer-events-none border border-neutral-700/50 flex flex-col items-center leading-tight">
                <span className="font-medium">1x1 Grid</span>
              </div>
            </button>
            <button 
              onClick={() => { 
                setLayout(2); 
                setMaximizedIndex(null); 
              }}
              className={`group relative p-2 rounded-md transition-colors ${layout === 2 ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}
            >
              <Columns className="w-5 h-5" />
              <div className="absolute top-full right-0 mt-2 px-2.5 py-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-500 whitespace-nowrap z-50 pointer-events-none border border-neutral-700/50 flex flex-col items-center leading-tight">
                <span className="font-medium">1x2 Grid</span>
              </div>
            </button>
            <button 
              onClick={() => { 
                setLayout(4); 
                setMaximizedIndex(null); 
              }}
              className={`group relative p-2 rounded-md transition-colors ${layout === 4 ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'}`}
            >
              <Grid2X2 className="w-5 h-5" />
              <div className="absolute top-full right-0 mt-2 px-2.5 py-1.5 bg-neutral-800 text-neutral-200 text-xs rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-500 whitespace-nowrap z-50 pointer-events-none border border-neutral-700/50 flex flex-col items-center leading-tight">
                <span className="font-medium">2x2 Grid</span>
              </div>
            </button>
            <div className="w-px h-6 bg-neutral-700 mx-2" />
            <button
              onClick={() => setShowDisclaimer(true)}
              className="px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500/90 border border-amber-500/20 hover:border-amber-500/40 rounded text-[10px] uppercase tracking-wider font-bold transition-colors"
              title="View Disclaimer"
            >
              Not for diagnostic use
            </button>
            <div className="w-px h-6 bg-neutral-700 mx-1" />
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="p-2 rounded-md transition-colors text-neutral-400 hover:bg-neutral-800 hover:text-white"
              title="Help & Shortcuts"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-neutral-700 mx-1" />
            <button
              onClick={toggleSidebar}
              className={`p-2 rounded-md transition-colors ${!isSidebarOpen ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}
              title={isSidebarOpen ? "Close Sidebar (Zen Mode)" : "Open Sidebar"}
            >
              {isSidebarOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Viewport Grid */}
        <div className="flex-1 bg-black p-1 relative z-10">
          <div className={`w-full h-full grid gap-1 ${getGridClasses(layout)}`}>
            {Array.from({ length: layout }).map((_, index) => {
              const vpState = viewports[index];
              const vpStudy = studies.find(s => s.studyInstanceUID === vpState.studyInstanceUID);
              const vpSeries = vpStudy?.series.find(ser => ser.seriesInstanceUID === vpState.seriesInstanceUID);
              const activeInstance = vpSeries?.instances[vpState.imageIndex];
              const markers = getOrientationMarkers(activeInstance?.metadata.imageOrientationPatient || null);
              
              const isMaximized = maximizedIndex === index;
              const isHidden = maximizedIndex !== null && maximizedIndex !== index;

              return (
              <div 
                key={index} 
                onDoubleClick={(e) => handleDoubleClick(e, index)}
                onMouseDown={(e) => {
                  isPointerDraggingRef.current = false;
                  if (e.buttons > 1 || e.button !== 0) {
                    lastMultiButtonInteraction.current = window.performance.now();
                  }
                }}
                onMouseUp={(e) => {
                  if (isPointerDraggingRef.current || e.button !== 0 || e.buttons > 0) {
                    lastMultiButtonInteraction.current = window.performance.now();
                  }
                  if (e.buttons === 0) {
                    isPointerDraggingRef.current = false;
                  }
                }}
                className={`bg-neutral-900 border rounded-sm overflow-hidden flex flex-col ${dragOverViewport === index ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-neutral-800'} ${isMaximized ? 'absolute inset-1 z-20' : 'relative'} ${isHidden ? 'opacity-0 pointer-events-none' : ''}`}
                onWheel={(e) => handleWheel(e, index)}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-dicom-series')) {
                    e.preventDefault();
                  }
                }}
                onDragEnter={(e) => {
                  if (e.dataTransfer.types.includes('application/x-dicom-series')) {
                    e.preventDefault();
                    setDragOverViewport(index);
                  }
                }}
                onDragLeave={(e) => {
                  if (e.dataTransfer.types.includes('application/x-dicom-series')) {
                    setDragOverViewport(null);
                  }
                }}
                onDrop={(e) => {
                  const data = e.dataTransfer.getData('application/x-dicom-series');
                  if (data) {
                    e.preventDefault();
                    setDragOverViewport(null);
                    const { studyInstanceUID, seriesInstanceUID } = JSON.parse(data);
                    loadSeriesIntoViewport(index, studyInstanceUID, seriesInstanceUID);
                  }
                }}
              >
                {/* Cornerstone Viewport Container */}
                <div 
                  ref={(el) => { viewportRefs.current[index] = el; }}
                  className={`absolute inset-0 z-0 bg-black touch-none ${activeTool === 'pixel' ? 'cursor-none' : ''}`}
                  onContextMenu={(e) => e.preventDefault()}
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  onPointerEnter={() => setActiveViewportIndex(index)}
                  onPointerMove={(e) => handlePointerMove(e, index)}
                  onPointerUp={(e) => handlePointerUp(e, index)}
                />

                {/* Viewport Overlay Info */}
                <div className="absolute top-2 left-2 text-xs text-emerald-400 z-10 pointer-events-none drop-shadow-md">
                  {vpState?.studyInstanceUID ? (
                    <>
                      {vpStudy?.patientName || 'Unknown Patient'}<br />
                      ID: {vpStudy?.patientId || '-'}
                    </>
                  ) : (
                    <>
                      Patient Name<br />
                      ID: -
                    </>
                  )}
                </div>
                <div className="absolute top-2 right-2 text-xs text-emerald-400 text-right z-10 pointer-events-none drop-shadow-md">
                  {vpState?.seriesInstanceUID ? (
                    <>
                      Study Date: {vpStudy?.studyDate ? formatDicomDate(vpStudy.studyDate) : '-'}<br />
                      {vpSeries?.seriesDescription || '-'}
                    </>
                  ) : (
                    <>
                      Study Date: -<br />
                      Series: -
                    </>
                  )}
                </div>
                <div className="absolute bottom-2 left-2 text-xs text-emerald-400 z-10 pointer-events-none drop-shadow-md">
                  {vpState?.seriesInstanceUID ? (
                    <>
                      sr: {(vpStudy?.series.findIndex(s => s.seriesInstanceUID === vpState.seriesInstanceUID) ?? -1) + 1}/{vpStudy?.series.length || 1}<br />
                      img: {vpState.imageIndex + 1}/{vpSeries?.instances.length || 1}
                    </>
                  ) : (
                    <>
                      sr: -/-<br />
                      img: -/-
                    </>
                  )}
                  <div id={`overlay-wl-zoom-${index}`}>
                    WL: 500 WW: 1000
                  </div>
                </div>
                
                {/* Orientation Markers */}
                {vpState?.seriesInstanceUID && (
                  <>
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 text-red-500 font-bold text-sm z-10 pointer-events-none drop-shadow-md">
                      {markers.top}
                    </div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-red-500 font-bold text-sm z-10 pointer-events-none drop-shadow-md">
                      {markers.bottom}
                    </div>
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-red-500 font-bold text-sm z-10 pointer-events-none drop-shadow-md">
                      {markers.left}
                    </div>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 font-bold text-sm z-10 pointer-events-none drop-shadow-md">
                      {markers.right}
                    </div>
                  </>
                )}

                {/* Info Button & Metadata Overlay */}
                {vpState?.seriesInstanceUID && activeInstance?.metadata && (
                  <div className="absolute bottom-2 right-2 z-30 group flex flex-col items-end">
                    <div 
                      className="absolute bottom-full right-0 mb-2 w-[350px] max-w-[90vw] z-40 bg-neutral-900/95 border border-neutral-700/80 rounded-lg shadow-2xl flex flex-col backdrop-blur-md overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 delay-0 group-hover:delay-500 origin-bottom-right"
                      onWheel={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center p-2.5 border-b border-neutral-800 bg-neutral-900">
                        <h3 className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 text-emerald-400" />
                          DICOM Metadata
                        </h3>
                      </div>
                      <div className="p-3 text-[11px] font-mono text-neutral-300 select-text whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto cursor-text">
{`Institution Name: ${activeInstance.metadata.institutionName || 'Unknown'}
Series Description: ${activeInstance.metadata.seriesDescription || 'Unknown'}
Acquisition Date: ${formatDicomDate(activeInstance.metadata.acquisitionDate || activeInstance.metadata.studyDate)} ${formatDicomTime(activeInstance.metadata.acquisitionTime)}
Manufacturer: ${activeInstance.metadata.manufacturer || 'Unknown'}
Model: ${activeInstance.metadata.model || 'Unknown'}
Field Strength: ${activeInstance.metadata.fieldStrength ? formatNumber(activeInstance.metadata.fieldStrength, 2) + ' T' : 'Unknown'}

Slice Thickness: ${activeInstance.metadata.sliceThickness ? formatNumber(activeInstance.metadata.sliceThickness) + ' mm' : 'Unknown'}
Spacing Between Slices: ${activeInstance.metadata.spacingBetweenSlices ? formatNumber(activeInstance.metadata.spacingBetweenSlices) + ' mm' : 'Unknown'}
Pixel Spacing: ${activeInstance.metadata.pixelSpacing ? activeInstance.metadata.pixelSpacing.map(p => formatNumber(p)).join(' x ') + ' mm' : 'Unknown'}
Acquisition Matrix: ${activeInstance.metadata.rows && activeInstance.metadata.columns ? activeInstance.metadata.rows + ' x ' + activeInstance.metadata.columns : 'Unknown'}

Scanning Sequence: ${activeInstance.metadata.scanningSequence || 'Unknown'}
TR: ${activeInstance.metadata.tr ? formatNumber(activeInstance.metadata.tr, 0) + ' ms' : 'Unknown'} / TE: ${activeInstance.metadata.te ? formatNumber(activeInstance.metadata.te, 0) + ' ms' : 'Unknown'}${activeInstance.metadata.ti ? '\nTI: ' + formatNumber(activeInstance.metadata.ti, 0) + ' ms' : ''}
Flip Angle: ${activeInstance.metadata.flipAngle ? activeInstance.metadata.flipAngle + '°' : 'Unknown'}
Echo Train Length (ETL): ${activeInstance.metadata.echoTrainLength || 'Unknown'}
Number of Echos: ${activeInstance.metadata.echoNumbers || 'Unknown'}`}
                      </div>
                    </div>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveInfoViewport(index); }}
                      className="p-1.5 bg-neutral-800/60 hover:bg-neutral-700/80 text-emerald-400/80 hover:text-emerald-400 rounded-md backdrop-blur-sm transition-colors border border-neutral-700/50 relative"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                )}
                
                {/* Raw DICOM Dump Modal */}
                {vpState?.seriesInstanceUID && activeInfoViewport === index && activeInstance?.metadata && (
                  <div 
                    className="absolute inset-2 z-50 bg-neutral-900/95 border border-neutral-700/80 rounded-lg shadow-2xl flex flex-col backdrop-blur-md overflow-hidden"
                    onWheel={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between p-3 border-b border-neutral-800 bg-neutral-900">
                      <h3 className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
                        <Info className="w-4 h-4 text-emerald-400" />
                        Raw DICOM Metadata
                      </h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => handleCopyRawData(e, index, activeInstance.metadata.rawTags!)}
                          className="p-1 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-white transition-colors flex items-center justify-center w-7 h-7"
                          title="Copy to clipboard"
                        >
                          {copiedRawDataIndex === index ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActiveInfoViewport(null); }}
                          className="p-1 hover:bg-neutral-800 rounded-md text-neutral-400 hover:text-white transition-colors flex items-center justify-center w-7 h-7"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-0">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-neutral-800 text-neutral-400 sticky top-0 border-b border-neutral-700">
                          <tr>
                            <th className="p-2 font-medium border-r border-neutral-700/50">Tag Name (Position)</th>
                            <th className="p-2 font-medium">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeInstance.metadata.rawTags?.map((rt, i) => (
                            <tr key={i} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                              <td className="p-2 font-mono text-neutral-400 border-r border-neutral-700/50 align-top">
                                <span className="text-neutral-300 font-sans mr-2">{rt.name}</span>
                                <span className="text-neutral-500 text-[10px]">{rt.tag}</span>
                              </td>
                              <td className="p-2 font-mono text-neutral-300 break-words">{rt.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Placeholder text */}
                {!vpState?.seriesInstanceUID && studies.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 pointer-events-none z-10 p-6 text-center select-none bg-black/40">
                    <svg className="w-12 h-12 mb-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-sm font-medium text-neutral-400 mb-2">No Image Loaded</h3>
                    <p className="text-xs max-w-[200px] mb-6">Select DICOM files using the Files sidebar, or drag and drop.</p>
                    
                    <div className="bg-neutral-800/80 border border-neutral-700/50 rounded-lg p-4 text-left w-72 backdrop-blur-sm shadow-xl">
                      <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-3 pb-2 border-b border-neutral-700/50">Mouse Controls</h4>
                      <ul className="text-xs space-y-2">
                        <li className="flex items-center justify-between"><span className="text-neutral-400">Left Click</span><span className="text-neutral-300">Active Tool</span></li>
                        <li className="flex items-center justify-between"><span className="text-neutral-400">Middle Click</span><span className="text-neutral-300">Pan</span></li>
                        <li className="flex items-center justify-between"><span className="text-neutral-400">Right Click</span><span className="text-neutral-300">Window (W/L)</span></li>
                        <li className="flex items-center justify-between"><span className="text-neutral-400">Left + Right Click</span><span className="text-neutral-300">Zoom</span></li>
                        <li className="flex items-center justify-between"><span className="text-neutral-400">Scroll Wheel</span><span className="text-neutral-300">Change Slice</span></li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>
        </div>
      </div>

      {/* Sidebar Panel */}
      <div 
        className={`flex flex-col bg-neutral-900 flex-shrink-0 z-20 shadow-xl border-neutral-800 transition-all duration-300 ease-in-out relative ${
          isSidebarOpen ? 'w-80 border-l' : 'w-0 border-l-0 overflow-hidden opacity-0'
        }`}
      >
        <div className="w-80 flex flex-col h-full absolute top-0 right-0">
        
        {/* Tabs */}
        <div className="flex h-14 border-b border-neutral-800 shrink-0">
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              activeTab === 'files' 
                ? 'bg-neutral-800 text-white border-b-2 border-blue-500' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Files
          </button>
          <button
            onClick={() => setActiveTab('reporting')}
            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              activeTab === 'reporting' 
                ? 'bg-neutral-800 text-white border-b-2 border-blue-500' 
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            Reporting
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {activeTab === 'reporting' ? (
            <form onSubmit={handleSaveReport} className="flex-1 flex flex-col p-4">
              {/* Study Summary Header */}
              {studies.length > 0 && (
                <div className="mb-3 p-2.5 bg-neutral-950/80 rounded-md border border-neutral-800 text-xs flex flex-col gap-1">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="font-medium text-neutral-300">Study Metadata</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40">Auto-included</span>
                  </div>
                  <div className="text-neutral-300 font-medium truncate">
                    {studies[0].patientName} • {studies[0].patientId}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {formatDicomDate(studies[0].studyDate)} {studies[0].studyDescription ? `• ${studies[0].studyDescription}` : ''}
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="findings" className="text-sm font-medium text-neutral-300">
                    Findings
                  </label>
                  <span className="text-[11px] text-neutral-500">
                    {reportText.trim().length} chars
                  </span>
                </div>
                <textarea
                  id="findings"
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Enter diagnostic findings here..."
                  className="flex-1 w-full min-h-[160px] bg-neutral-950 border border-neutral-700 rounded-md p-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none transition-shadow"
                />
              </div>

              {reportSavedStatus && (
                <div className="mb-3 p-2.5 bg-emerald-950/70 border border-emerald-700/60 rounded-md text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Report saved and downloaded successfully!</span>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 ${
                    reportSavedStatus 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {reportSavedStatus ? (
                    <>
                      <Check className="w-4 h-4" />
                      Report Saved & Downloaded
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Report
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white py-2 px-4 rounded-md text-xs font-medium border border-neutral-700 transition-colors focus:outline-none"
                >
                  {isReportCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Full Report Copied to Clipboard
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-400" />
                      Copy Full Report Text
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-4 flex flex-col h-full">
              <div 
                className={`${studies.length === 0 ? 'flex-1 flex-col p-6' : 'shrink-0 flex-row p-3'} border-2 border-dashed rounded-lg flex items-center justify-center text-center transition-colors cursor-pointer ${
                  isDragging 
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400' 
                    : 'border-neutral-700 bg-neutral-950/50 text-neutral-400 hover:border-neutral-500 hover:bg-neutral-900'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className={`${studies.length === 0 ? 'w-10 h-10 mb-3' : 'w-6 h-6 mr-3'} ${isDragging ? 'text-blue-400' : 'text-neutral-500'}`} />
                <div className={studies.length === 0 ? "" : "text-left"}>
                  <h3 className={`${studies.length === 0 ? 'text-sm mb-1' : 'text-sm'} font-medium text-neutral-200`}>
                    Drag & Drop DICOM Files
                  </h3>
                  <p className={`${studies.length === 0 ? 'text-xs' : 'text-[10px]'} text-neutral-500`}>
                    or click to select files${studies.length === 0 ? ' from your computer' : ''}
                  </p>
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileInput}
                  className="hidden" 
                  multiple 
                  {...({ webkitdirectory: "" } as any)}
                />
              </div>
              
              <div className="mt-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <h4 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    Loaded Studies
                  </h4>
                  {studies.length > 0 && (
                    <button
                      onClick={() => setShowRemoveAllDialog(true)}
                      className="text-xs text-neutral-500 hover:text-red-400 transition-colors px-2 py-0.5 rounded flex items-center gap-1 hover:bg-neutral-800"
                      title="Remove all loaded studies"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                </div>
                {studies.length === 0 ? (
                  <div className="text-xs text-neutral-600 italic text-center p-4 bg-neutral-950 rounded-md border border-neutral-800/50">
                    No studies loaded yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
                    {studies.map((study, i) => (
                      <div key={study.studyInstanceUID} className="flex flex-col gap-1">
                        {/* Study Header */}
                        <div className="text-[11px] text-emerald-500 font-medium px-1">
                          {study.patientName} • {formatDicomDate(study.studyDate)}
                        </div>
                        {/* Series List */}
                        <div className="flex flex-col gap-1">
                          {study.series.map((series) => {
                            const activeVps = viewports.map((vp, idx) => vp.seriesInstanceUID === series.seriesInstanceUID ? idx + 1 : null).filter(idx => idx !== null);
                            const isActive = activeVps.length > 0;
                            return (
                            <div 
                              key={series.seriesInstanceUID} 
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('application/x-dicom-series', JSON.stringify({
                                  studyInstanceUID: study.studyInstanceUID,
                                  seriesInstanceUID: series.seriesInstanceUID
                                }));
                              }}
                              className="text-xs text-neutral-300 p-2 bg-neutral-950 rounded-md border border-neutral-800 flex gap-3 cursor-grab active:cursor-grabbing hover:border-neutral-600 transition-colors"
                              onClick={() => loadSeriesIntoViewport(0, study.studyInstanceUID, series.seriesInstanceUID)}
                            >
                              <div className="relative">
                                <SeriesThumbnail instance={series.instances[Math.floor(series.instances.length / 2)]} />
                                {isActive && (
                                  <div className="absolute -top-2 -left-2 flex flex-col gap-0.5 z-10">
                                    {activeVps.map(vpNum => (
                                      <span key={vpNum} className="px-1 bg-blue-500 text-white rounded-[3px] text-[9px] font-bold tracking-wider py-[1px] shadow-sm border border-blue-400">
                                        V{vpNum}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex flex-col flex-1 min-w-0 justify-between py-0.5">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center truncate">
                                    <FolderOpen className="w-3 h-3 mr-1 text-blue-400 shrink-0" />
                                    <span className="truncate font-medium">{series.seriesDescription || 'Unnamed Series'}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <span className="text-[10px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-400">
                                      {series.modality}
                                    </span>
                                    <button 
                                      onClick={(e) => handleRemoveSeries(e, study.studyInstanceUID, series.seriesInstanceUID)}
                                      className="p-[3px] text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors group/delete"
                                      title="Remove series"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="text-[10px] text-neutral-500 flex items-center justify-between">
                                  <span>{series.instances.length} Images</span>
                                  <span className="text-neutral-600 text-[9px] truncate max-w-[100px]">{series.seriesInstanceUID.slice(-8)}</span>
                                </div>
                              </div>
                            </div>
                          )})}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

    </div>
  );
}
