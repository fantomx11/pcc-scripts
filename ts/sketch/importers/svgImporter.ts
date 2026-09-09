import type { Point, Shape, Level, StubWall, WallMeta } from '../types';
import { snapToInch, sanitizeDimCode, isPointInsidePoly } from '../geometry';
import type { ImportResult } from './jsonImporter';

export interface SvgImportOptions {
  scaleUnits?: boolean;
  targetMode?: 'new_level' | 'current_level' | 'append_current';
  newLevelName?: string;
  currentLevelId: number;
  levels: Level[];
  shapes: Shape[];
  wallMetadataList: WallMeta[];
  getNextId: () => number;
  getNextLevelId: () => number;
}

const SVG_CLASS_MAP: Record<string, string> = {
  'living-room': 'Living Room',
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  office: 'Office',
  closet: 'Closet',
  laundry: 'Laundry',
  hallway: 'Hallway',
  staircase: 'Staircase',
  'dining-room': 'Dining Room',
  garage: 'Garage',
  other: 'Room',
};

export function parseSvgPathCoordinates(dStr: string, scale: number): Point[] {
  const clean = dStr.replace(/[MmLlZz]/g, ' ').trim();
  const nums = clean.split(/[\s,]+/).map(parseFloat).filter((n) => !isNaN(n));
  const pts: Point[] = [];
  for (let i = 0; i < nums.length; i += 2) {
    if (i + 1 < nums.length) {
      pts.push({
        x: snapToInch(nums[i] * scale),
        y: snapToInch(nums[i + 1] * scale),
      });
    }
  }
  return pts;
}

export function extractStubsAndCleanSvgPolygon(
  rawPts: Point[],
  getNextId: () => number,
  tolFt = 0.3
): { cleanPoints: Point[]; stubWalls: StubWall[] } {
  const points = rawPts.map((p) => ({ ...p }));
  const stubWalls: StubWall[] = [];
  let collapsed = true;
  let maxIterations = 100;

  while (collapsed && points.length >= 3 && maxIterations-- > 0) {
    collapsed = false;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];

      const dPrevNext = Math.hypot(prev.x - next.x, prev.y - next.y);
      const spurLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);

      if (dPrevNext <= tolFt && spurLen > tolFt) {
        stubWalls.push({
          id: `stub_svg_${getNextId()}`,
          p0: { x: prev.x, y: prev.y },
          p1: { x: curr.x, y: curr.y },
          meta: {
            id: `meta_svg_${getNextId()}`,
            p0: { x: prev.x, y: prev.y },
            p1: { x: curr.x, y: curr.y },
            thicknessFt: 4 / 12,
            thicknessUnits: 508,
            thicknessInches: 4,
            isInvisible: false,
            openings: [],
          },
        });

        if (i === n - 1) {
          points.splice(n - 1, 1);
          points.splice(0, 1);
        } else {
          points.splice(i, 2);
        }
        collapsed = true;
        break;
      }
    }
  }

  return { cleanPoints: points, stubWalls };
}

export function importSvgString(svgText: string, opts: SvgImportOptions): ImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid SVG document format.');
  }

  const scale = opts.scaleUnits ? 3.28084 : 1.0;
  const labelElements = doc.querySelectorAll('g.room-label');
  const extractedLabels: Array<{ x: number; y: number; text: string }> = [];

  labelElements.forEach((g) => {
    const transformAttr = g.getAttribute('style') || g.getAttribute('transform') || '';
    const match = transformAttr.match(/translate\(\s*([\d.-]+)(?:px)?\s*,\s*([\d.-]+)(?:px)?\s*\)/i);
    const textElem = g.querySelector('text');
    if (match && textElem) {
      extractedLabels.push({
        x: parseFloat(match[1]) * scale,
        y: parseFloat(match[2]) * scale,
        text: textElem.textContent?.trim() || '',
      });
    }
  });

  let roomPaths = Array.from(
    doc.querySelectorAll('g.rooms path, g.active-rooms path, path[data-roomid]')
  ) as SVGPathElement[];

  if (roomPaths.length === 0) {
    roomPaths = Array.from(doc.querySelectorAll('path')).filter((p) => {
      const cls = (p.getAttribute('class') || '').toLowerCase();
      return (
        !cls.includes('wall') &&
        !cls.includes('divider') &&
        !cls.includes('opening') &&
        !cls.includes('label')
      );
    }) as SVGPathElement[];
  }

  roomPaths = roomPaths.filter((p) => {
    if (p.closest('g.shadow, g.silhouette, g.lower-floor, g.upper-floor, [data-shadow]')) return false;
    const cls = (p.getAttribute('class') || '').toLowerCase();
    return !cls.includes('inaccessible') && !cls.includes('shadow') && !cls.includes('silhouette');
  });

  let activeLevels = [...opts.levels];
  let activeShapes = [...opts.shapes];
  let activeWallMeta = [...opts.wallMetadataList];
  let targetLevelId = opts.currentLevelId;

  if (opts.targetMode === 'new_level') {
    const newLvlName = opts.newLevelName || `Level ${activeLevels.length + 1}`;
    const newLvl = {
      id: opts.getNextLevelId(),
      name: newLvlName,
      levelNumber: activeLevels.length + 1,
    };
    activeLevels.push(newLvl);
    targetLevelId = newLvl.id;
  } else if (opts.targetMode === 'current_level') {
    activeShapes = activeShapes.filter((s) => s.levelId !== targetLevelId);
    activeWallMeta = [];
  }

  const newShapes: Shape[] = [];
  const usedNames: Record<string, number> = {};

  roomPaths.forEach((path) => {
    const d = path.getAttribute('d');
    if (!d) return;
    const rawPts = parseSvgPathCoordinates(d, scale);
    if (rawPts.length < 3) return;

    const { cleanPoints, stubWalls } = extractStubsAndCleanSvgPolygon(rawPts, opts.getNextId);
    if (cleanPoints.length < 3) return;

    let matchedName = '';
    for (const lbl of extractedLabels) {
      if (isPointInsidePoly(lbl, cleanPoints)) {
        matchedName = lbl.text;
        break;
      }
    }
    if (!matchedName) {
      matchedName = SVG_CLASS_MAP[(path.getAttribute('class') || '').trim()] || 'Room';
    }

    usedNames[matchedName] = (usedNames[matchedName] || 0) + 1;
    const finalName = usedNames[matchedName] > 1 ? `${matchedName} ${usedNames[matchedName]}` : matchedName;

    newShapes.push({
      id: opts.getNextId(),
      levelId: targetLevelId,
      type: 'room',
      name: finalName,
      dimCode: sanitizeDimCode(finalName),
      isDimCodeManual: false,
      ceilingHeightFt: 8.0,
      points: cleanPoints,
      stubWalls,
    });
  });

  return {
    shapes: activeShapes.concat(newShapes),
    levels: activeLevels,
    currentLevelId: targetLevelId,
    wallMetadata: activeWallMeta,
  };
}