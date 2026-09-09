import type { Point, Shape, WallMeta, Level, Opening, StubWall } from '../types';
import { snapToInch, sanitizeDimCode, UNITS_PER_INCH } from '../geometry';

export interface JsonImportOptions {
  scaleUnits?: boolean;
  filterVoids?: boolean;
  targetMode?: 'new_level' | 'current_level' | 'append_current';
  newLevelName?: string;
  currentLevelId: number;
  levels: Level[];
  shapes: Shape[];
  wallMetadataList: WallMeta[];
  getNextId: () => number;
  getNextLevelId: () => number;
}

export interface ImportResult {
  shapes: Shape[];
  levels: Level[];
  currentLevelId: number;
  wallMetadata: WallMeta[];
  modelName?: string;
}

export function quantizeWallThickness(rawMeters: number, isInvisible = false) {
  if (isInvisible || rawMeters <= 0.03) {
    return { inches: 0, units: 0, feet: 0 };
  }
  const rawInches = rawMeters * 39.37007874;
  const inchesRounded = Math.max(2, Math.round(rawInches / 2) * 2);
  const units = inchesRounded * UNITS_PER_INCH;
  const feet = inchesRounded / 12;
  return { inches: inchesRounded, units, feet };
}

export function unwindTopologicalRoomEdges(
  boundaryEdges: Array<{ id: string }>,
  edgeLookup: Map<string, any>
): { poly: Point[]; stubEdges: any[] } | null {
  if (!boundaryEdges || boundaryEdges.length < 3) return null;

  const adj = new Map<string, Array<{ nbr: string; edgeId: string }>>();
  const edgeMap = new Map<string, any>();

  boundaryEdges.forEach((be) => {
    const ed = edgeLookup.get(be.id);
    if (!ed) return;
    edgeMap.set(ed.id, ed);

    if (!adj.has(ed.v0Id)) adj.set(ed.v0Id, []);
    if (!adj.has(ed.v1Id)) adj.set(ed.v1Id, []);

    adj.get(ed.v0Id)!.push({ nbr: ed.v1Id, edgeId: ed.id });
    adj.get(ed.v1Id)!.push({ nbr: ed.v0Id, edgeId: ed.id });
  });

  let prunedAny = true;
  const removedEdgeIds = new Set<string>();
  while (prunedAny) {
    prunedAny = false;
    for (const [v, nbrs] of adj.entries()) {
      if (nbrs.length === 1) {
        const item = nbrs[0];
        removedEdgeIds.add(item.edgeId);
        adj.set(v, []);
        const otherNbrs = adj.get(item.nbr) || [];
        adj.set(item.nbr, otherNbrs.filter((x) => x.nbr !== v));
        prunedAny = true;
      }
    }
  }

  const cycleEdgeIds = boundaryEdges
    .map((be) => be.id)
    .filter((id) => edgeMap.has(id) && !removedEdgeIds.has(id));
  const stubEdges = Array.from(removedEdgeIds).map((id) => edgeMap.get(id)).filter(Boolean);

  if (cycleEdgeIds.length < 3) return null;

  const remaining = cycleEdgeIds.map((id) => {
    const ed = edgeMap.get(id);
    return {
      id: ed.id,
      v0Id: ed.v0Id,
      v1Id: ed.v1Id,
      p0: { ...ed.p0 },
      p1: { ...ed.p1 },
    };
  });

  const first = remaining.shift()!;
  const path: Point[] = [first.p0, first.p1];
  let lastVId = first.v1Id;

  while (remaining.length > 0) {
    const curr = path[path.length - 1];
    let bestIdx = -1;
    let bestRev = false;

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      if (lastVId && seg.v0Id === lastVId) {
        bestIdx = i;
        bestRev = false;
        break;
      } else if (lastVId && seg.v1Id === lastVId) {
        bestIdx = i;
        bestRev = true;
        break;
      }
    }

    if (bestIdx === -1) {
      let bestD = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const d0 = Math.hypot(curr.x - seg.p0.x, curr.y - seg.p0.y);
        const d1 = Math.hypot(curr.x - seg.p1.x, curr.y - seg.p1.y);
        if (d0 < bestD) { bestD = d0; bestIdx = i; bestRev = false; }
        if (d1 < bestD) { bestD = d1; bestIdx = i; bestRev = true; }
      }
      if (bestIdx === -1 || bestD > 0.45) break;
    }

    const seg = remaining.splice(bestIdx, 1)[0];
    path.push(bestRev ? seg.p0 : seg.p1);
    lastVId = bestRev ? seg.v0Id : seg.v1Id;
  }

  if (path.length > 3) {
    const dClose = Math.hypot(path[0].x - path[path.length - 1].x, path[0].y - path[path.length - 1].y);
    if (dClose < 0.25) {
      path.pop();
    }
  }

  return path.length >= 3 ? { poly: path, stubEdges } : null;
}

export function importJsonModel(json: any, opts: JsonImportOptions): ImportResult {
  const scale = opts.scaleUnits ? 3.28084 : 1.0;
  const filterVoids = opts.filterVoids !== false;

  const data = json.data?.model || json.model || json;
  const floors = data.floors || [];
  const allRooms = data.rooms || [];
  const modelName = data.name || json.data?.model?.name || json.model?.name || json.name;

  let activeLevels = [...opts.levels];
  let activeShapes = [...opts.shapes];
  let activeWallMeta = [...opts.wallMetadataList];
  let activeLevelId = opts.currentLevelId;

  const floorLevelMap = new Map<string, number>();

  if (floors.length > 1) {
    activeLevels = [];
    floors.forEach((fl: any, idx: number) => {
      const lvlId = opts.getNextLevelId();
      const lvlName = `Level ${idx + 1}`;
      activeLevels.push({ id: lvlId, name: lvlName, levelNumber: idx + 1 });
      floorLevelMap.set(fl.id, lvlId);
    });
    activeLevelId = activeLevels[0].id;
    activeShapes = [];
    activeWallMeta = [];
  } else {
    if (opts.targetMode === 'new_level') {
      const newLvlName = opts.newLevelName || `Level ${activeLevels.length + 1}`;
      const newLvl = {
        id: opts.getNextLevelId(),
        name: newLvlName,
        levelNumber: activeLevels.length + 1,
      };
      activeLevels.push(newLvl);
      activeLevelId = newLvl.id;
    } else if (opts.targetMode === 'current_level') {
      activeShapes = activeShapes.filter((s) => s.levelId !== activeLevelId);
      activeWallMeta = [];
    }
    floorLevelMap.set(floors[0]?.id || 'fl0', activeLevelId);
  }

  const newShapes: Shape[] = [];
  const usedNames: Record<string, number> = {};

  floors.forEach((fl: any) => {
    const targetLevelId = floorLevelMap.get(fl.id) || activeLevelId;
    const floorEdges = fl.edges || [];
    const edgeLookup = new Map<string, any>();

    let floorBaseZM = 0;
    const floorRoomsForZ = allRooms.filter((r: any) => !r.floor || r.floor.id === fl.id);
    const zValues: number[] = [];
    floorRoomsForZ.forEach((r: any) => {
      (r.ceiling?.planes || []).forEach((pl: any) => {
        (pl.measurements || []).forEach((m: any) => {
          if (m.bottom && typeof m.bottom.z === 'number') zValues.push(m.bottom.z);
        });
      });
    });
    if (zValues.length > 0) {
      zValues.sort((a, b) => a - b);
      floorBaseZM = zValues[0];
    }

    floorEdges.forEach((ed: any) => {
      if (!ed.vertices || ed.vertices.length < 2) return;
      const v0 = ed.vertices[0];
      const v1 = ed.vertices[1];

      const p0Ft = { x: snapToInch(v0.position.x * scale), y: snapToInch(-v0.position.y * scale) };
      const p1Ft = { x: snapToInch(v1.position.x * scale), y: snapToInch(-v1.position.y * scale) };
      const isInvis = ed.type === 'invisible';
      const tQuant = quantizeWallThickness(ed.thickness || 0.14, isInvis);

      const openingsList: Opening[] = (ed.openings || []).map((op: any) => {
        const lbl = (op.label || '').toLowerCase();
        const opType = (op.type || '').toLowerCase();

        const isWin = lbl.includes('window') || opType === 'window';
        const isDr =
          !isWin &&
          (opType === 'doorway' ||
            lbl.includes('door') ||
            lbl.includes('pivot') ||
            lbl.includes('hinged') ||
            lbl.includes('swing') ||
            lbl.includes('sliding') ||
            lbl.includes('bifold') ||
            lbl.includes('pocket') ||
            lbl.includes('french')) &&
          !lbl.includes('divider') &&
          !lbl.includes('cased');

        const isMissing = !isWin && !isDr;

        const rawLowerElevationM = op.lowerElevation || 0.0;
        let relLowerElevationM = rawLowerElevationM;
        if (floorBaseZM > 1.0 && rawLowerElevationM > 1.0) {
          relLowerElevationM = rawLowerElevationM - floorBaseZM;
        }
        if (relLowerElevationM < 0.04 && relLowerElevationM > -0.06) {
          relLowerElevationM = 0.0;
        }
        const lowerElevationFt = Math.max(0, relLowerElevationM * scale);

        return {
          id: op.id || `op_${opts.getNextId()}`,
          widthFt: (op.width || 0.9) * scale,
          heightFt: (op.height || 2.0) * scale,
          lowerElevationFt,
          relativeCenter: op.relativeCenter !== undefined ? op.relativeCenter : 0.5,
          label: isWin ? 'Window' : isDr ? 'Door' : 'Opening',
          isWindow: isWin,
          isDoor: isDr,
          isMissingWall: isMissing,
        };
      });

      const edgeData: WallMeta = {
        id: ed.id,
        p0: p0Ft,
        p1: p1Ft,
        thicknessFt: tQuant.feet,
        thicknessUnits: tQuant.units,
        thicknessInches: tQuant.inches,
        centerLineBias: ed.centerLineBias !== undefined ? ed.centerLineBias : 0.5,
        isInvisible: isInvis,
        openings: openingsList,
      };

      edgeLookup.set(ed.id, edgeData);
      activeWallMeta.push(edgeData);
    });

    const floorRooms = allRooms.filter(
      (r: any) => !r.floor || r.floor.id === fl.id || allRooms.length === 1
    );

    (floorRooms.length > 0 ? floorRooms : allRooms).forEach((rm: any) => {
      if (filterVoids) {
        const isVoid = (rm.classifications || []).some(
          (c: any) => c.label && c.label.toLowerCase() === 'void'
        );
        const isHidden = (rm.keywords || []).some((k: string) =>
          ['hide', 'nonarea'].includes(k.toLowerCase())
        );
        if (isVoid || isHidden) return;
      }

      const bEdges = rm.boundary?.edges || [];
      const unwindRes = unwindTopologicalRoomEdges(bEdges, edgeLookup);
      if (!unwindRes) return;

      const { poly, stubEdges } = unwindRes;

      let roomName = rm.label || '';
      if (!roomName && rm.classifications && rm.classifications.length > 0) {
        roomName = rm.classifications[0].label;
      }
      if (!roomName || roomName.toLowerCase() === 'other') roomName = 'Room';

      usedNames[roomName] = (usedNames[roomName] || 0) + 1;
      const finalName = usedNames[roomName] > 1 ? `${roomName} ${usedNames[roomName]}` : roomName;

      let ceilHtFt = 8.0;
      if (rm.ceiling && rm.ceiling.maxHeight && rm.ceiling.maxHeight > 0) {
        ceilHtFt = rm.ceiling.maxHeight * scale;
      } else if (rm.dimensionEstimates && rm.dimensionEstimates.height && rm.dimensionEstimates.height > 0) {
        ceilHtFt = rm.dimensionEstimates.height * scale;
      }
      ceilHtFt = Math.round(ceilHtFt * 4) / 4;

      const attachedStubs: StubWall[] = (stubEdges || []).map((st: any) => ({
        id: st.id,
        p0: { ...st.p0 },
        p1: { ...st.p1 },
        meta: st,
      }));

      newShapes.push({
        id: opts.getNextId(),
        levelId: targetLevelId,
        type: 'room',
        name: finalName,
        dimCode: sanitizeDimCode(finalName),
        isDimCodeManual: false,
        ceilingHeightFt: ceilHtFt,
        points: poly,
        stubWalls: attachedStubs,
      });
    });
  });

  return {
    shapes: activeShapes.concat(newShapes),
    levels: activeLevels,
    currentLevelId: activeLevelId,
    wallMetadata: activeWallMeta,
    modelName: typeof modelName === 'string' ? modelName.trim() : undefined,
  };
}