import type { Point } from './types';

export const UNITS_PER_FT = 1524;
export const UNITS_PER_INCH = 127;
export const ELEV_FLOOR = 152400; // 100 ft baseline
export const DEFAULT_CEIL_HEIGHT = 12192; // 8ft

export function generateExUuid(): string {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function sanitizeDimCode(val?: string): string {
  if (!val) return '';
  return val
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 10);
}

export function snapToInch(valFt: number): number {
  return Math.round(valFt * 12) / 12;
}

export function formatFtIn(feet: number): string {
  const totalInches = Math.round(feet * 12);
  const ft = Math.floor(totalInches / 12);
  const inch = totalInches % 12;
  return `${ft}' ${inch}"`;
}

export function parseFeetInches(str?: string): number | null {
  if (!str) return null;
  const trimmed = str.trim();

  const pureInchMatch = trimmed.match(/^([\d.]+)\s*(?:"|in|inch|inches)$/i);
  if (pureInchMatch) {
    const val = parseFloat(pureInchMatch[1]);
    return isNaN(val) || val <= 0 ? null : val / 12;
  }

  if (/^[\d.]+\s*(?:ft|')?$/i.test(trimmed)) {
    const val = parseFloat(trimmed);
    return isNaN(val) || val <= 0 ? null : val;
  }

  let fracVal = 0;
  const fracMatch = trimmed.match(/(\d+)\s*\/\s*(\d+)/);
  let cleanStr = trimmed;
  if (fracMatch) {
    fracVal = parseFloat(fracMatch[1]) / parseFloat(fracMatch[2]);
    cleanStr = trimmed.replace(fracMatch[0], '');
  }

  const ftMatch = cleanStr.match(/(\d+(?:\.\d+)?)\s*(?:'|ft|feet)/i);
  let ft = 0;
  let inch = 0;

  if (ftMatch) {
    ft = parseFloat(ftMatch[1]);
    const rem = cleanStr.substring(cleanStr.indexOf(ftMatch[0]) + ftMatch[0].length);
    const inchNums = rem.match(/\d+(?:\.\d+)?/);
    inch = (inchNums ? parseFloat(inchNums[0]) : 0) + fracVal;
  } else {
    const nums = cleanStr.match(/\d+(?:\.\d+)?/g);
    if (nums) {
      if (nums.length >= 2) {
        ft = parseFloat(nums[0]);
        inch = parseFloat(nums[1]) + fracVal;
      } else if (nums.length === 1) {
        ft = parseFloat(nums[0]);
        inch = fracVal;
      }
    } else if (fracVal > 0) {
      inch = fracVal;
    }
  }

  const total = ft + inch / 12;
  return total > 0 ? total : null;
}

export function getPolygonSignedArea(pts: Point[]): number {
  const n = pts.length;
  let a = 0.0;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    a += p1.x * p2.y - p2.x * p1.y;
  }
  return a / 2.0;
}

export function ensureWindingOrder(pts: Point[], targetClockwise = true): Point[] {
  const area = getPolygonSignedArea(pts);
  const isClockwise = area < 0;
  if (targetClockwise && !isClockwise) {
    return pts.slice().reverse();
  }
  if (!targetClockwise && isClockwise) {
    return pts.slice().reverse();
  }
  return pts.slice();
}

export function getCentroid(pts: Point[]): Point {
  let x = 0;
  let y = 0;
  pts.forEach((p) => {
    x += p.x;
    y += p.y;
  });
  return { x: x / (pts.length || 1), y: y / (pts.length || 1) };
}

export function isPointInsidePoly(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}