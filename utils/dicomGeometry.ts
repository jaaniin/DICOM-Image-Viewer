export const dot = (a: number[], b: number[]) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
export const cross = (a: number[], b: number[]) => [
  a[1]*b[2] - a[2]*b[1],
  a[2]*b[0] - a[0]*b[2],
  a[0]*b[1] - a[1]*b[0]
];
export const sub = (a: number[], b: number[]) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
export const add = (a: number[], b: number[]) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
export const mul = (a: number[], s: number) => [a[0]*s, a[1]*s, a[2]*s];

export const getDominantAxis = (vector: number[]) => {
  const absX = Math.abs(vector[0]);
  const absY = Math.abs(vector[1]);
  const absZ = Math.abs(vector[2]);
  const max = Math.max(absX, absY, absZ);

  if (max === absX) return vector[0] > 0 ? 'L' : 'R';
  if (max === absY) return vector[1] > 0 ? 'P' : 'A';
  return vector[2] > 0 ? 'H' : 'F';
};

export const getOppositeAxis = (axis: string) => {
  switch(axis) {
    case 'L': return 'R';
    case 'R': return 'L';
    case 'A': return 'P';
    case 'P': return 'A';
    case 'H': return 'F';
    case 'F': return 'H';
    default: return '';
  }
};

export const getOrientationMarkers = (iop: number[] | null) => {
  if (!iop || iop.length < 6) return { top: '', bottom: '', left: '', right: '' };

  const rowVector = iop.slice(0, 3);
  const colVector = iop.slice(3, 6);

  const rightLabel = getDominantAxis(rowVector);
  const leftLabel = getOppositeAxis(rightLabel);

  const bottomLabel = getDominantAxis(colVector);
  const topLabel = getOppositeAxis(bottomLabel);

  return { top: topLabel, bottom: bottomLabel, left: leftLabel, right: rightLabel };
};

export const calculateIntersection = (metaA: any, metaB: any) => {
  const ippA = metaA.imagePositionPatient;
  const iopA = metaA.imageOrientationPatient;
  const psA = metaA.pixelSpacing || [1, 1];
  
  const ippB = metaB.imagePositionPatient;
  const iopB = metaB.imageOrientationPatient;
  const psB = metaB.pixelSpacing || [1, 1];

  if (!ippA || !iopA || !ippB || !iopB || !metaA.rows || !metaA.columns) return null;

  const OA = ippA;
  const RA = iopA.slice(0, 3);
  const CA = iopA.slice(3, 6);
  const NA = cross(RA, CA);

  const OB = ippB;
  const RB = iopB.slice(0, 3);
  const CB = iopB.slice(3, 6);
  const NB = cross(RB, CB);

  // Are they parallel?
  const dir = cross(NA, NB);
  if (Math.abs(dir[0]) < 1e-5 && Math.abs(dir[1]) < 1e-5 && Math.abs(dir[2]) < 1e-5) return null;

  const wA = metaA.columns * psA[1];
  const hA = metaA.rows * psA[0];

  const TL = OA;
  const TR = add(OA, mul(RA, wA));
  const BL = add(OA, mul(CA, hA));
  const BR = add(TR, mul(CA, hA));

  const edges = [[TL, TR], [TR, BR], [BR, BL], [BL, TL]];
  const intersectionPoints: {x: number, y: number}[] = [];

  for (const [P1, P2] of edges) {
    const d1 = dot(NB, sub(P1, OB));
    const d2 = dot(NB, sub(P2, OB));

    if (d1 * d2 <= 0 && (d1 !== 0 || d2 !== 0)) {
      const t = d1 / (d1 - d2);
      const X = add(P1, mul(sub(P2, P1), t));

      const X_OB = sub(X, OB);
      const x = dot(X_OB, RB) / psB[1];
      const y = dot(X_OB, CB) / psB[0];
      
      intersectionPoints.push({ x, y });
    }
  }

  const uniquePts: {x: number, y: number}[] = [];
  for (const pt of intersectionPoints) {
    if (!uniquePts.some(p => Math.abs(p.x - pt.x) < 0.1 && Math.abs(p.y - pt.y) < 0.1)) {
      uniquePts.push(pt);
    }
  }

  if (uniquePts.length >= 2) {
    return [uniquePts[0], uniquePts[1]];
  }
  return null;
};

export const crossProduct = (a: number[], b: number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[0] * b[1] - a[1] * b[0], // NOTE: I'm copying it as it was but let's check it. Wait, the original was:
  // a[1] * b[2] - a[2] * b[1],
  // a[2] * b[0] - a[0] * b[2],
  // a[0] * b[1] - a[1] * b[0]
];

export const dotProduct = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const subVectors = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const addVectors = (a: number[], b: number[]) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scaleVector = (a: number[], s: number) => [a[0] * s, a[1] * s, a[2] * s];
export const getNormal = (orientation: number[]) => {
  const x = orientation.slice(0, 3);
  const y = orientation.slice(3, 6);
  return cross(x, y);
};
