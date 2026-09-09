import type { Shape, WallMeta, CeilingViolation, RoomCeilingReport, RoomCeilingViolationSummary, Level } from '../types';

export function distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function findWallMeta(pA: { x: number; y: number }, pB: { x: number; y: number }, wallMetaList: WallMeta[], tol = 0.35): WallMeta | null {
  for (const meta of wallMetaList) {
    const d1 = Math.hypot(meta.p0.x - pA.x, meta.p0.y - pA.y) + Math.hypot(meta.p1.x - pB.x, meta.p1.y - pB.y);
    const d2 = Math.hypot(meta.p0.x - pB.x, meta.p0.y - pB.y) + Math.hypot(meta.p1.x - pA.x, meta.p1.y - pA.y);
    if (Math.min(d1, d2) < tol) return meta;
  }
  return null;
}

export function getRoomCeilingViolations(room: Shape, wallMetaList: WallMeta[]): RoomCeilingReport {
  if (!room || room.type !== 'room') return { maxTop: 0, violations: [], ceilFt: 8.0 };

  const ceilFt = room.ceilingHeightFt || 8.0;
  let maxTop = 0;
  const violations: CeilingViolation[] = [];

  const inspectWall = (p1: { x: number; y: number }, p2: { x: number; y: number }, customMeta?: WallMeta) => {
    const meta = customMeta || findWallMeta(p1, p2, wallMetaList);
    if (!meta || !meta.openings) return;
    meta.openings.forEach(op => {
      const rawHFt = op.heightFt || (op.isDoor ? 6.6667 : 3.0);
      const rawBaseFt = Math.max(0, op.lowerElevationFt || 0);

      const hFt = Math.max(2 / 12, Math.round(rawHFt * 6) / 6);
      const baseFt = Math.max(0, Math.round(rawBaseFt * 6) / 6);
      const topFt = baseFt + hFt;

      if (topFt > maxTop) maxTop = topFt;
      if (topFt > ceilFt + 0.001) {
        violations.push({
          op,
          label: op.label || (op.isWindow ? 'Window' : op.isDoor ? 'Door' : 'Opening'),
          topFt,
          baseFt,
          heightFt: hFt,
          diffFt: topFt - ceilFt,
        });
      }
    });
  };

  const n = room.points.length;
  for (let i = 0; i < n; i++) {
    inspectWall(room.points[i], room.points[(i + 1) % n]);
  }
  (room.stubWalls || []).forEach(sw => {
    inspectWall(sw.p0, sw.p1, sw.meta);
  });

  return { maxTop, violations, ceilFt };
}

export function getAllCeilingViolations(shapes: Shape[], levels: Level[], wallMetaList: WallMeta[]): RoomCeilingViolationSummary[] {
  const list: RoomCeilingViolationSummary[] = [];
  shapes.filter(s => s.type === 'room').forEach(room => {
    const res = getRoomCeilingViolations(room, wallMetaList);
    if (res.violations.length > 0) {
      const lvl = levels.find(l => l.id === room.levelId);
      list.push({
        room,
        levelName: lvl ? lvl.name : `Level ${room.levelId}`,
        ceilFt: res.ceilFt,
        maxTop: res.maxTop,
        violations: res.violations,
      });
    }
  });
  return list;
}