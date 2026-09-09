import type { Shape, WallMeta, Level, InteriorWindowViolation } from '../types';
import { distToSegment } from './ceilingValidator';

export function getInteriorWindowViolations(
  shapes: Shape[],
  levels: Level[],
  wallMetaList: WallMeta[]
): InteriorWindowViolation[] {
  const violations: InteriorWindowViolation[] = [];
  const checkedPairs = new Set<string>();

  levels.forEach(lvl => {
    const lvlRooms = shapes.filter(s => s.levelId === lvl.id && s.type === 'room');
    if (lvlRooms.length < 2) return;

    wallMetaList.forEach(meta => {
      if (!meta.openings || meta.openings.length === 0) return;

      meta.openings.forEach(op => {
        if (!op.isWindow) return;

        const opKey = `${meta.id}_${op.id}`;
        if (checkedPairs.has(opKey)) return;

        const rc = op.relativeCenter !== undefined ? op.relativeCenter : 0.5;
        const opPt = {
          x: meta.p0.x + rc * (meta.p1.x - meta.p0.x),
          y: meta.p0.y + rc * (meta.p1.y - meta.p0.y),
        };

        const touchingRooms: Shape[] = [];
        lvlRooms.forEach(room => {
          const n = room.points.length;
          for (let i = 0; i < n; i++) {
            const p1 = room.points[i];
            const p2 = room.points[(i + 1) % n];
            if (distToSegment(opPt, p1, p2) <= 0.35) {
              if (!touchingRooms.some(r => r.id === room.id)) {
                touchingRooms.push(room);
              }
              break;
            }
          }
        });

        if (touchingRooms.length >= 2) {
          checkedPairs.add(opKey);
          violations.push({
            metaId: meta.id,
            opId: op.id,
            op,
            meta,
            levelId: lvl.id,
            levelName: lvl.name,
            rooms: touchingRooms,
          });
        }
      });
    });
  });

  return violations;
}