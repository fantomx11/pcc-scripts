import { Shape, Level, WallMeta } from '../types';

const UNITS_PER_FT = 1524;
const ELEV_FLOOR = 152400;
const DEFAULT_CEIL_HEIGHT = 12192;

interface CanonicalPoint {
  id: number;
  x: number;
  y: number;
  botIndex: number;
  topIndex: number;
  vertexId: number;
  connectedWallIds: number[];
}

function getPolygonSignedArea(pts: { x: number; y: number }[]): number {
  let a = 0.0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    a += p1.x * p2.y - p2.x * p1.y;
  }
  return a / 2.0;
}

function ensureClockwise(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  return getPolygonSignedArea(pts) < 0 ? pts.slice() : pts.slice().reverse();
}

export function buildXactimateXml(
  shapes: Shape[],
  levels: Level[],
  wallMetadata: WallMeta[],
  generateUuid: () => string,
  getNextId: () => number
): string {
  let minY = Infinity, maxY = -Infinity;
  shapes.forEach(s => {
    s.points.forEach(p => {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
  });
  const cy = (minY + maxY) / 2;

  const coordinates: string[] = ["0 0 0", "-97129.6 25527 0", "-102679.5 33210.5 0", "-84645.5 33337.5 0"];
  const BASE_ANCHOR_X = -105918;
  const BASE_ANCHOR_Y = 20701;

  let levelsXML = '';
  let globalRoomCount = 0;

  levels.forEach((lvl, lIdx) => {
    const lvlFloorElevation = ELEV_FLOOR + lIdx * DEFAULT_CEIL_HEIGHT;
    const levelKey = `GRP${21 + lIdx}`;
    const lvlRooms = shapes.filter(s => s.levelId === lvl.id && s.type === 'room');
    if (lvlRooms.length === 0) return;

    // 1. Transform coordinates and enforce clockwise winding AFTER flip
    const processedRooms = lvlRooms.map(room => {
      const flipped = room.points.map(p => ({
          x: p.x,
        y: Math.round((2 * cy - p.y) * 12) / 12
        }));
        return {
          ...room,
        points: ensureClockwise(flipped)
        };
      });

    const canonicalPoints: CanonicalPoint[] = [];
    function getCanonicalPoint(p: { x: number; y: number }, roomCeilFt = 8.0, tol = 0.08): CanonicalPoint {
      for (const cp of canonicalPoints) {
        if (Math.hypot(cp.x - p.x, cp.y - p.y) <= tol) return cp;
      }
      const xu = BASE_ANCHOR_X + Math.round(p.x * UNITS_PER_FT);
      const yu = BASE_ANCHOR_Y + Math.round(p.y * UNITS_PER_FT);
      const lvlCeilElevation = lvlFloorElevation + Math.round(roomCeilFt * UNITS_PER_FT);

      const botIdx = coordinates.length;
      coordinates.push(`${xu} ${yu} ${lvlFloorElevation}`);
      const topIdx = coordinates.length;
      coordinates.push(`${xu} ${yu} ${lvlCeilElevation}`);

      const cp: CanonicalPoint = {
        id: canonicalPoints.length,
        x: p.x,
        y: p.y,
        botIndex: botIdx,
        topIndex: topIdx,
        vertexId: getNextId(),
        connectedWallIds: []
      };
      canonicalPoints.push(cp);
      return cp;
    }

    const edgesMap = new Map<string, any>();
    const roomEdgeLists = new Map<number, number[]>();

    // 2. Build wall edges sequentially to keep traversal order intact
    processedRooms.forEach(room => {
      const wallIdsForRoom: number[] = [];
      const n = room.points.length;
      const roomCeil = room.ceilingHeightFt || 8.0;

      for (let i = 0; i < n; i++) {
        const p1 = room.points[i];
        const p2 = room.points[(i + 1) % n];
        const cpA = getCanonicalPoint(p1, roomCeil);
        const cpB = getCanonicalPoint(p2, roomCeil);
        if (cpA.id === cpB.id) continue;

        const edgeKey = `${Math.min(cpA.id, cpB.id)}_${Math.max(cpA.id, cpB.id)}`;

        if (!edgesMap.has(edgeKey)) {
          const wId = getNextId();
          edgesMap.set(edgeKey, {
            id: wId,
            roomIDs: [room.id],
            cpA,
            cpB,
            dimCode: `W${edgesMap.size}`
          });
          wallIdsForRoom.push(wId);
        } else {
          const edgeData = edgesMap.get(edgeKey);
          if (!edgeData.roomIDs.includes(room.id)) edgeData.roomIDs.push(room.id);
          wallIdsForRoom.push(edgeData.id);
        }
      }
      roomEdgeLists.set(room.id, wallIdsForRoom);
    });

    edgesMap.forEach(edge => {
      if (!edge.cpA.connectedWallIds.includes(edge.id)) edge.cpA.connectedWallIds.push(edge.id);
      if (!edge.cpB.connectedWallIds.includes(edge.id)) edge.cpB.connectedWallIds.push(edge.id);
    });

    // 3. Serialize SKETCHROOM using numeric wall IDs
    let roomsXML = '';
    processedRooms.forEach(room => {
      globalRoomCount++;
      const wallIds = roomEdgeLists.get(room.id) || [];
      const ceilFt = (room.ceilingHeightFt || 8.0).toFixed(7);

      roomsXML += `<SKETCHROOM id="SKT${room.id}" exUuid="${generateUuid()}" prevReadOrder="40" dimCode="${room.dimCode || 'ROOM'}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" key="GRP${globalRoomCount + 55}" grpType="1" parentKey="${levelKey}" grpDesc="${room.name}" mainRoomID="0" lastDims="" wallIDs="${wallIds.join(' ')}" floorHeight="0.0000000" ceilingType="0" ceilingColor="-16777217" floorColor="-16777217" ceilingTexture="0" textureID="0" ceilingHeight="${ceilFt}" flags="0" above="1"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateUuid()}" prevReadOrder="41" color="-16777216" fontFace="Tahoma" fontSize="10" fontStyle="5" angle="0.0000000" namePosition="1" posInit="1" justify="1" flags="3" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[${room.name}]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHROOM>`;
    });

    // 4. Serialize SKETCHWALL using numeric room and vertex IDs
    let wallsXML = '';
    edgesMap.forEach(edge => {
      const isShared = edge.roomIDs.length > 1;
      const roomIDsStr = isShared ? `${edge.roomIDs[0]} ${edge.roomIDs[1]}` : `${edge.roomIDs[0]} 0`;
      const wallFlags = isShared ? '788529152' : '385875968';
      const coordIdx = `${edge.cpA.botIndex} ${edge.cpB.botIndex} ${edge.cpB.topIndex} ${edge.cpA.topIndex}`;
      const vertIds = `${edge.cpA.vertexId} ${edge.cpB.vertexId}`;

      wallsXML += `<SKETCHWALL id="SKT${edge.id}" exUuid="${generateUuid()}" prevReadOrder="28" dimCode="${edge.dimCode}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" roomIDs="${roomIDsStr}" coordIndex="${coordIdx}" vertexIDs="${vertIds}" flags="${wallFlags}" wallConstruction="0" thickness="508.0000000" bearingWall="0" extendExtWallSurfDown="1" extendExtWallSurfDownLength="1524.0000000" wallHeight="12192.0000000"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateUuid()}" prevReadOrder="29" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="8" posInit="1" justify="1" flags="0" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[${edge.dimCode}]]></SKETCHCDATACHILD></SKETCHLABEL><SKETCHWALLSURFACE id="SKT${getNextId()}" exUuid="${generateUuid()}" prevReadOrder="30" dimCode="WS1" side="0" color="-16777217"/><SKETCHWALLSURFACE id="SKT${getNextId()}" exUuid="${generateUuid()}" prevReadOrder="33" dimCode="WS2" side="1" color="-16777217"/></SKETCHWALL>`;
    });

    // 5. Serialize SKETCHLEVELVERTEX linking adjacent walls at corners
    let verticesXML = '';
    canonicalPoints.forEach(cp => {
      if (cp.connectedWallIds.length > 0) {
        verticesXML += `<SKETCHLEVELVERTEX id="SKT${cp.vertexId}" exUuid="${generateUuid()}" prevReadOrder="36" vertex="${cp.botIndex}" wallIDs="${cp.connectedWallIds.join(' ')}"/>`;
      }
    });

    levelsXML += `<SKETCHLEVEL id="SKT${103 + lIdx}" exUuid="${generateUuid()}" prevReadOrder="3" name="${lvl.name}" dimCode="LVL_${lIdx + 1}" key="${levelKey}" grpType="11" parentKey="GRP1" grpDesc="${lvl.name}" levelNumber="${lvl.levelNumber}" floorElevation="${lvlFloorElevation}.0000000">${roomsXML}${wallsXML}${verticesXML}</SKETCHLEVEL>`;
  });

  return `<?xml version='1.0' encoding='UTF-8' ?><SKETCHDOCUMENT id="SKT${getNextId()}" exUuid="${generateUuid()}" majorVersion="1" minorVersion="27" buildNum="3400"><SKETCHSTRUCTURE structureType="0" id="SKT${getNextId()}" exUuid="${generateUuid()}">${levelsXML}</SKETCHSTRUCTURE><COORDINATE3>${coordinates.join(' ')}</COORDINATE3></SKETCHDOCUMENT>`;
}