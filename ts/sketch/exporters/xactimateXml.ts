import type { Shape, Level, WallMeta, OpeningDefaults } from '../types';
import {
  generateExUuid,
  sanitizeDimCode,
  snapToInch,
  ensureWindingOrder,
  getCentroid,
  isPointInsidePoly,
  UNITS_PER_FT,
  ELEV_FLOOR,
  DEFAULT_CEIL_HEIGHT,
} from '../geometry';
import { findWallMeta } from '../validators/ceilingValidator';
import { SQ_UNITS_PER_SQ_FT } from '../validators/deductionValidator';

interface CanonicalPoint {
  id: number;
  x: number;
  y: number;
  botIndex: number;
  topIndex: number;
  vertexId: number;
  connectedWallIds: number[];
}

export function generateXML(
  shapes: Shape[],
  levels: Level[],
  wallMetadataList: WallMeta[],
  openingDefaults: OpeningDefaults
): string {
  if (shapes.length === 0) return '';

  let idSeed = 3000;
  const getNextId = () => idSeed++;

  let minY = Infinity;
  let maxY = -Infinity;
  shapes.forEach((s) => {
    s.points.forEach((p) => {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    });
    (s.stubWalls || []).forEach((sw) => {
      minY = Math.min(minY, sw.p0.y, sw.p1.y);
      maxY = Math.max(maxY, sw.p0.y, sw.p1.y);
    });
  });
  const cy = (minY + maxY) / 2;

  const coordinates: string[] = [
    '0 0 0',
    '-97129.6 25527 0',
    '-102679.5 33210.5 0',
    '-84645.5 33337.5 0',
  ];
  const BASE_ANCHOR_X = -105918;
  const BASE_ANCHOR_Y = 20701;

  let levelsXML = '';
  let globalRoomCount = 0;

  levels.forEach((lvl, lIdx) => {
    const levelUuid = generateExUuid();
    const lvlShapes = shapes.filter((s) => s.levelId === lvl.id);
    const lvlFloorElevation = ELEV_FLOOR + lIdx * DEFAULT_CEIL_HEIGHT;
    const levelKey = `GRP${21 + lIdx}`;

    if (lvlShapes.length === 0) return;

    const lvlRooms = lvlShapes
      .filter((s) => s.type === 'room')
      .map((room) => {
        const xactPts = room.points.map((p) => ({
          x: p.x,
          y: snapToInch(2 * cy - p.y),
        }));
        const xactStubs = (room.stubWalls || []).map((sw) => ({
          ...sw,
          p0: { x: sw.p0.x, y: snapToInch(2 * cy - sw.p0.y) },
          p1: { x: sw.p1.x, y: snapToInch(2 * cy - sw.p1.y) },
        }));
        return {
          ...room,
          points: ensureWindingOrder(xactPts, true),
          stubWalls: xactStubs,
        };
      });

    const lvlLines = lvlShapes
      .filter((s) => s.type === 'line')
      .map((line) => ({
        ...line,
        points: line.points.map((p) => ({
          x: p.x,
          y: snapToInch(2 * cy - p.y),
        })),
      }));

    const lvlSectors = lvlShapes
      .filter((s) => s.type === 'area' || s.type === 'block')
      .map((sec) => {
        const xactPts = sec.points.map((p) => ({
          x: p.x,
          y: snapToInch(2 * cy - p.y),
        }));
        return {
          ...sec,
          points: ensureWindingOrder(xactPts, true),
        };
      });

    const canonicalPoints: CanonicalPoint[] = [];
    function getCanonicalPoint(p: { x: number; y: number }, roomCeilFt = 8.0, tol = 0.08): CanonicalPoint {
      for (let i = 0; i < canonicalPoints.length; i++) {
        const cp = canonicalPoints[i];
        if (Math.hypot(cp.x - p.x, cp.y - p.y) <= tol) return cp;
      }
      const xu = BASE_ANCHOR_X + Math.round(p.x * UNITS_PER_FT);
      const yu = BASE_ANCHOR_Y + Math.round(p.y * UNITS_PER_FT);
      const ceilHeightUnits = Math.round(roomCeilFt * UNITS_PER_FT);
      const lvlCeilElevation = lvlFloorElevation + ceilHeightUnits;

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
        connectedWallIds: [],
      };
      canonicalPoints.push(cp);
      return cp;
    }

    const edgesMap = new Map<string, any>();
    const roomEdgeLists = new Map<number, number[]>();

    lvlRooms.forEach((room) => {
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
        const origP1 = { x: p1.x, y: snapToInch(2 * cy - p1.y) };
        const origP2 = { x: p2.x, y: snapToInch(2 * cy - p2.y) };
        const meta = findWallMeta(origP1, origP2, wallMetadataList);

        if (!edgesMap.has(edgeKey)) {
          const wId = getNextId();
          edgesMap.set(edgeKey, {
            id: wId,
            isStub: false,
            roomIDs: [room.id],
            cpA,
            cpB,
            dimCode: `W${edgesMap.size || ''}`,
            meta,
          });
          wallIdsForRoom.push(wId);
        } else {
          const edgeData = edgesMap.get(edgeKey);
          if (!edgeData.roomIDs.includes(room.id)) edgeData.roomIDs.push(room.id);
          if (!edgeData.meta && meta) edgeData.meta = meta;
          wallIdsForRoom.push(edgeData.id);
        }
      }

      (room.stubWalls || []).forEach((sw) => {
        const cpA = getCanonicalPoint(sw.p0, roomCeil);
        const cpB = getCanonicalPoint(sw.p1, roomCeil);
        if (cpA.id === cpB.id) return;

        const edgeKey = `STUB_${room.id}_${Math.min(cpA.id, cpB.id)}_${Math.max(cpA.id, cpB.id)}`;
        const wId = getNextId();
        edgesMap.set(edgeKey, {
          id: wId,
          isStub: true,
          roomIDs: [room.id, room.id],
          cpA,
          cpB,
          dimCode: `W${edgesMap.size || ''}`,
          meta: sw.meta,
        });
        wallIdsForRoom.push(wId);
      });

      roomEdgeLists.set(room.id, wallIdsForRoom);
    });

    edgesMap.forEach((edge) => {
      if (!edge.cpA.connectedWallIds.includes(edge.id)) edge.cpA.connectedWallIds.push(edge.id);
      if (!edge.cpB.connectedWallIds.includes(edge.id)) edge.cpB.connectedWallIds.push(edge.id);
    });

    let roomsXML = '';
    lvlRooms.forEach((room, rIdx) => {
      globalRoomCount++;
      const roomWallIds = roomEdgeLists.get(room.id) || [];
      const roomDimCode = room.dimCode || `ROOM${rIdx + 1}`;
      const roomCeilFt = (room.ceilingHeightFt || 8.0).toFixed(7);

      let linesXML = '';
      lvlLines.forEach((line) => {
        const center = getCentroid(line.points);
        if (isPointInsidePoly(center, room.points) || lvlRooms.length === 1) {
          const ptIndices: number[] = [];
          line.points.forEach((lp) => {
            const lxu = BASE_ANCHOR_X + Math.round(lp.x * UNITS_PER_FT);
            const lyu = BASE_ANCHOR_Y + Math.round(lp.y * UNITS_PER_FT);
            ptIndices.push(coordinates.length);
            coordinates.push(`${lxu} ${lyu} ${lvlFloorElevation}`);
          });

          linesXML += `<SKETCHREFLINE id="SKT${line.id}" exUuid="${generateExUuid()}" prevReadOrder="0" dimCode="${line.dimCode}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" mainItemID="0" baseHeight="0.0000000" height="0.0000000" color="-16777217" textureID="0" width="0.0000000" wall0="0" wall1="0" wall0Dist="0.0000000" wall1Dist="0.0000000" wall0Side="0" wall1Side="0" isBeam="0" beamPos="1" flags="0" underStairs="0" attachedObjID="0" attachedFace="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="0" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="2" posInit="1" justify="0" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[${line.name}]]></SKETCHCDATACHILD></SKETCHLABEL><SKETCHREFLINEGEOM id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="0" controlPoints="${ptIndices.join(' ')}" pointFlags="${ptIndices.map(() => '0').join(' ')}" flags="0"/></SKETCHREFLINE>`;
        }
      });

      roomsXML += `<SKETCHROOM id="SKT${room.id}" exUuid="${generateExUuid()}" prevReadOrder="40" dimCode="${roomDimCode}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" key="GRP${globalRoomCount + 55}" grpType="1" parentKey="${levelKey}" grpDesc="${room.name}" mainRoomID="0" lastDims="" wallIDs="${roomWallIds.join(' ')}" floorHeight="0.0000000" ceilingType="0" ceilingColor="-16777217" floorColor="-16777217" ceilingTexture="0" textureID="0" ceilingHeight="${roomCeilFt}" flags="0" above="1" floorFrameOrient="0" floorConst="0" ffrmCenters="1" ffrmJoists="FRMIJ9" ffrmRimBoard="FRMIJ9" ffrmSheathing="FRMSHW3/4T" ffrmBeams="FRMBMM2X8" ffrmDoBeams="0" slabThickness="508.0000000" slabIsReinforced="0" slabRebarSize="CNCRB4" slabVertSpacing="1524.0000000" slabHorzSpacing="1524.0000000" useRollCarpetFromHere="0" flooringMinFillCut="3048.0000000" flooringMinFillCutWidth="3048.0000000" flooringSeamOverCut="381.0000000" flooringRoomOverCut="381.0000000" useScrap="1" useGroupFloorLayDir="0" maxFillPieces="4" autoELEDone="0" autoPLMDone="0" attachedRoof="0" castBeamBeamBlock="NONE_OPTION" castBeamInsulation="NONE_OPTION" castBeamSlab="NONE_OPTION" castBeamReinforce="NONE_OPTION" castBeamReinforceMesh="NONE_OPTION" castBeamFloorScreed="NONE_OPTION" latitude="0.0000000" longitude="0.0000000" carpetStartingWallID="0" waterMitZoneId="0" arCaptureDuration="0.0000000" arCapturedInAR="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="41" color="-16777216" fontFace="Tahoma" fontSize="10" fontStyle="5" angle="0.0000000" namePosition="1" posInit="1" justify="1" flags="3" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[${room.name}]]></SKETCHCDATACHILD></SKETCHLABEL>${linesXML}</SKETCHROOM>`;
    });

    let wallsXML = '';
    let openCount = 0;
    edgesMap.forEach((edge) => {
      let roomIDsStr = '';
      let wallFlags = '385875968';

      if (edge.isStub) {
        roomIDsStr = `${edge.roomIDs[0]} ${edge.roomIDs[0]}`;
        wallFlags = '251658240';
      } else if (edge.roomIDs.length > 1) {
        roomIDsStr = `${edge.roomIDs[0]} ${edge.roomIDs[1]}`;
        wallFlags = '788529152';
      } else {
        roomIDsStr = `${edge.roomIDs[0]} 0`;
        wallFlags = '385875968';
      }

      const coordIdx = `${edge.cpA.botIndex} ${edge.cpB.botIndex} ${edge.cpB.topIndex} ${edge.cpA.topIndex}`;
      const vertIds = `${edge.cpA.vertexId} ${edge.cpB.vertexId}`;
      const meta = edge.meta;
      const isInvisible = meta && meta.isInvisible;
      const wallThickness = isInvisible ? '0.0000000' : meta && meta.thicknessUnits ? `${meta.thicknessUnits}.0000000` : '508.0000000';

      let wallOpeningsXML = '';

      if (isInvisible) {
        openCount++;
        const deductUnits = ((openingDefaults.missingWallDeductArea || 0.0) * SQ_UNITS_PER_SQ_FT).toFixed(7);
        wallOpeningsXML += `<SKETCHWALLOPENING id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="0" dimCode="WO${openCount}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" coordIndex="${coordIdx}" baseHeight="0.0000000" flags="3198" type="0" newShape="0" shape="0" color="-657956" textureID="0" openingPos="0" doubleDoorManuallySet="0" windowAHt="3048.0000000" windowBHt="6096.0000000" defWindowDeductOpeningArea="${deductUnits}" wireFaceMarkedReplace="0" wireFaceUserMarkedReplace="0" isContainmentBarrier="0" woTrim="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="0" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="0" posInit="0" justify="1" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[WO]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHWALLOPENING>`;
      }

      if (meta && meta.openings && meta.openings.length > 0) {
        const wallLenFt = Math.hypot(edge.cpB.x - edge.cpA.x, edge.cpB.y - edge.cpA.y) || 1;
        const xuA = BASE_ANCHOR_X + Math.round(edge.cpA.x * UNITS_PER_FT);
        const yuA = BASE_ANCHOR_Y + Math.round(edge.cpA.y * UNITS_PER_FT);
        const xuB = BASE_ANCHOR_X + Math.round(edge.cpB.x * UNITS_PER_FT);
        const yuB = BASE_ANCHOR_Y + Math.round(edge.cpB.y * UNITS_PER_FT);

        meta.openings.forEach((op: any) => {
          openCount++;
          const rc = op.relativeCenter !== undefined ? op.relativeCenter : 0.5;

          const rawWFt = op.widthFt || 3.0;
          const rawHFt = op.heightFt || 6.6667;
          const rawBaseFt = Math.max(0, op.lowerElevationFt || 0);

          const wFt = Math.max(2 / 12, Math.round(rawWFt * 6) / 6);
          const hFt = Math.max(2 / 12, Math.round(rawHFt * 6) / 6);
          const baseFt = Math.max(0, Math.round(rawBaseFt * 6) / 6);

          const origMetaP0_xact = { x: meta.p0.x, y: snapToInch(2 * cy - meta.p0.y) };
          const origMetaP1_xact = { x: meta.p1.x, y: snapToInch(2 * cy - meta.p1.y) };

          const cXactX = origMetaP0_xact.x + rc * (origMetaP1_xact.x - origMetaP0_xact.x);
          const cXactY = origMetaP0_xact.y + rc * (origMetaP1_xact.y - origMetaP0_xact.y);

          const segDx = edge.cpB.x - edge.cpA.x;
          const segDy = edge.cpB.y - edge.cpA.y;
          const segL2 = segDx * segDx + segDy * segDy;
          let tCenter = 0.5;
          if (segL2 > 1e-6) {
            tCenter = ((cXactX - edge.cpA.x) * segDx + (cXactY - edge.cpA.y) * segDy) / segL2;
          }

          const dt = wFt / 2 / wallLenFt;
          const t1 = Math.max(0, tCenter - dt);
          const t2 = Math.min(1, tCenter + dt);

          const opX1 = Math.round(xuA + t1 * (xuB - xuA));
          const opY1 = Math.round(yuA + t1 * (yuB - yuA));
          const opX2 = Math.round(xuA + t2 * (xuB - xuA));
          const opY2 = Math.round(yuA + t2 * (yuB - yuA));

          const baseUnits = Math.round(baseFt * UNITS_PER_FT);
          const heightUnits = Math.round(hFt * UNITS_PER_FT);
          const zBot = lvlFloorElevation + baseUnits;
          const zTop = zBot + heightUnits;

          const i1 = coordinates.length; coordinates.push(`${opX1} ${opY1} ${zBot}`);
          const i2 = coordinates.length; coordinates.push(`${opX2} ${opY2} ${zBot}`);
          const i3 = coordinates.length; coordinates.push(`${opX2} ${opY2} ${zTop}`);
          const i4 = coordinates.length; coordinates.push(`${opX1} ${opY1} ${zTop}`);

          let deductValSqFt = 0.0;
          if (op.isDoor) deductValSqFt = openingDefaults.doorDeductArea;
          else if (op.isWindow) deductValSqFt = openingDefaults.windowDeductArea;
          else deductValSqFt = openingDefaults.missingWallDeductArea;

          const deductStr = (deductValSqFt * SQ_UNITS_PER_SQ_FT).toFixed(7);

          if (op.isWindow) {
            wallOpeningsXML += `<SKETCHWALLOPENING id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="4" dimCode="WINDOW${openCount}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" coordIndex="${i1} ${i2} ${i3} ${i4}" baseHeight="${baseUnits}.0000000" flags="552" type="1" newShape="0" shape="0" color="-657956" textureID="0" openingPos="0" doubleDoorManuallySet="0" windowType="1" windowAHt="${Math.round(heightUnits / 2)}.0000000" windowBHt="${heightUnits}.0000000" defWindowDeductOpeningArea="${deductStr}" wireFaceMarkedReplace="0" wireFaceUserMarkedReplace="0" isContainmentBarrier="0" woTrim="1"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="5" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="0" posInit="0" justify="1" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[Window]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHWALLOPENING>`;
          } else if (op.isDoor) {
            const isDoubleDoor = wFt >= 3.999;
            const doubleDoorVal = isDoubleDoor ? '1' : '0';
            const doorFlags = isDoubleDoor ? '312' : '56';

            wallOpeningsXML += `<SKETCHWALLOPENING id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="6" dimCode="DOOR${openCount}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" coordIndex="${i1} ${i2} ${i3} ${i4}" baseHeight="${baseUnits}.0000000" flags="${doorFlags}" type="2" newShape="0" shape="0" color="-657956" textureID="0" openingPos="0" doubleDoorManuallySet="${doubleDoorVal}" doorType="0" doorStyle="0" doorAngle="20" defWindowDeductOpeningArea="${deductStr}" wireFaceMarkedReplace="0" wireFaceUserMarkedReplace="0" isContainmentBarrier="0" woTrim="1"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="7" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="0" posInit="0" justify="1" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[Door]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHWALLOPENING>`;
          } else {
            wallOpeningsXML += `<SKETCHWALLOPENING id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="0" dimCode="WO${openCount}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" coordIndex="${i1} ${i2} ${i3} ${i4}" baseHeight="${baseUnits}.0000000" flags="56" type="0" newShape="0" shape="0" color="-657956" textureID="0" openingPos="0" doubleDoorManuallySet="0" windowAHt="${Math.round(heightUnits / 2)}.0000000" windowBHt="${heightUnits}.0000000" defWindowDeductOpeningArea="${deductStr}" wireFaceMarkedReplace="0" wireFaceUserMarkedReplace="0" isContainmentBarrier="0" woTrim="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="0" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="0" posInit="0" justify="1" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[MissingWall]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHWALLOPENING>`;
          }
        });
      }

      wallsXML += `<SKETCHWALL id="SKT${edge.id}" exUuid="${generateExUuid()}" prevReadOrder="28" dimCode="${edge.dimCode}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" roomIDs="${roomIDsStr}" coordIndex="${coordIdx}" vertexIDs="${vertIds}" flags="${wallFlags}" wallConstruction="0" thickness="${wallThickness}" bearingWall="0" extendExtWallSurfDown="1" extendExtWallSurfDownLength="1524.0000000" wfrmCenters="1" wfrmStudSize="2x4" wfrmStudSizeAuto="0" wfrmTrimmerStyle="1" wfrmHeaderSize="2x10" deckAddHandRail="0" castBeamBeamBlock="NONE_OPTION" castBeamInsulation="NONE_OPTION" brickFacing="NONE_OPTION" metalStudSize="NONE_OPTION" metalStudCenter="0" headTrack="NONE_OPTION" floorTrack="NONE_OPTION" masonryFinish="NONE_OPTION" wallArcControlPt="0" sharedSnapRecordIds="" activityAreaEdge="0" doFooting="0" footingHeight="1270.0000000" footingWidth="2540.0000000" rebarSize="CNCRB4" rebarNumber="2" jBarType="CNCRBJ42" spacing="1524.0000000" wfrmNumTopPlates="2" fndWallRebarSize="CNCRB4" fndWallSpacerDistVert="1524.0000000" fndWallSpacerDistHorz="1524.0000000" fndWallBlockSize="MASBL4" foundationSill="FRMDBP6" foundationSillState="0" wallHeight="12192.0000000" deckEndBoardType="2" noRoofFace="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="29" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="8" posInit="1" justify="1" flags="0" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[${edge.dimCode}]]></SKETCHCDATACHILD></SKETCHLABEL><SKETCHWALLSURFACE id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="30" dimCode="WS1" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" side="0" color="-16777217" textureID="0" sheathing="FRMSHW1/2" liningLayer="0" lingingBoard="NONE_OPTION" liningFinish="NONE_OPTION" wallSurfLiningID="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="31" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="8" posInit="1" justify="1" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[WS1]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHWALLSURFACE><SKETCHWALLSURFACE id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="33" dimCode="WS2" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" side="1" color="-16777217" textureID="0" sheathing="FRMSHW1/2" liningLayer="0" lingingBoard="NONE_OPTION" liningFinish="NONE_OPTION" wallSurfLiningID="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="34" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="8" posInit="1" justify="1" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[WS2]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHWALLSURFACE>${wallOpeningsXML}</SKETCHWALL>`;
    });

    let verticesXML = '';
    canonicalPoints.forEach((cp) => {
      if (cp.connectedWallIds.length > 0) {
        verticesXML += `<SKETCHLEVELVERTEX id="SKT${cp.vertexId}" exUuid="${generateExUuid()}" prevReadOrder="36" vertex="${cp.botIndex}" wallIDs="${cp.connectedWallIds.join(' ')}"/>`;
      }
    });

    let sectorWallsXML = '';
    let sectorsXML = '';

    lvlSectors.forEach((sec, sIdx) => {
      const isBlock = sec.type === 'block';
      const n = sec.points.length;
      const ptIndices: number[] = [];
      const swIds: number[] = [];
      const svIds: number[] = [];

      for (let i = 0; i < n; i++) {
        const pt = sec.points[i];
        const xu = BASE_ANCHOR_X + Math.round(pt.x * UNITS_PER_FT);
        const yu = BASE_ANCHOR_Y + Math.round(pt.y * UNITS_PER_FT);
        ptIndices.push(coordinates.length);
        coordinates.push(`${xu} ${yu} ${lvlFloorElevation}`);
        swIds.push(getNextId());
        svIds.push(getNextId());
      }

      const center = getCentroid(sec.points);
      let containRoomId = lvlRooms.length > 0 ? lvlRooms[0].id : 0;
      lvlRooms.forEach((r) => {
        if (isPointInsidePoly(center, r.points)) containRoomId = r.id;
      });

      for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        const swId = swIds[i];
        const svCurr = svIds[i];
        const svNext = svIds[next];
        const prevSw = swIds[(i - 1 + n) % n];

        verticesXML += `<SKETCHLEVELVERTEX id="SKT${svCurr}" exUuid="${generateExUuid()}" prevReadOrder="16" vertex="${ptIndices[i]}" wallIDs="${prevSw} ${swId}"/>`;

        sectorWallsXML += `<SKETCHSECTORWALL id="SKT${swId}" exUuid="${generateExUuid()}" prevReadOrder="4" dimCode="SW${i || ''}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" roomIDs="0 ${sec.id}" coordIndex="${ptIndices[i]} ${ptIndices[next]} ${ptIndices[next]} ${ptIndices[i]}" vertexIDs="${svCurr} ${svNext}" flags="721422464" wallConstruction="0" thickness="0.0000000" bearingWall="0" extendExtWallSurfDown="1" extendExtWallSurfDownLength="1524.0000000" wfrmCenters="1" wfrmStudSize="2x4" wfrmStudSizeAuto="0" wfrmTrimmerStyle="1" wfrmHeaderSize="2x10" deckAddHandRail="0" castBeamBeamBlock="NONE_OPTION" castBeamInsulation="NONE_OPTION" brickFacing="NONE_OPTION" metalStudSize="NONE_OPTION" metalStudCenter="1" headTrack="NONE_OPTION" floorTrack="NONE_OPTION" masonryFinish="NONE_OPTION" wallArcControlPt="0" sharedSnapRecordIds="" activityAreaEdge="0" doFooting="0" footingHeight="1270.0000000" footingWidth="2540.0000000" rebarSize="" rebarNumber="2" jBarType="" spacing="1524.0000000" wfrmNumTopPlates="1" fndWallRebarSize="" fndWallSpacerDistVert="1524.0000000" fndWallSpacerDistHorz="1524.0000000" fndWallBlockSize="NONE_OPTION" foundationSill="" foundationSillState="0" wallHeight="0.0000000" deckEndBoardType="2" noRoofFace="0" sectorFixedLenWall="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="5" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="46" posInit="1" justify="0" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="0"><SKETCHCDATACHILD><![CDATA[SW${i || ''}]]></SKETCHCDATACHILD></SKETCHLABEL><SKETCHBALUSTERPROPS id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="6" railHasRail="0" railHandrailHeight="4572.0000000" railConstruction="0" railHandrail="-1" falseCapTreads="" railBalusters="&amp;lt;BALUSTERS&amp;gt;&amp;lt;/BALUSTERS&amp;gt;" railNewels="-1" railFittings="&amp;lt;FITTINGS&amp;gt;&amp;lt;/FITTINGS&amp;gt;" railingShoe="-1" wallCap="-1" railingVolute="-1" railNumNewels="0" railNewelHeight="0.0000000"/><SKETCHWALLSURFACE id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="48" dimCode="WS" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" side="1" color="-16777217" textureID="0" sheathing="" liningLayer="0" lingingBoard="NONE_OPTION" liningFinish="NONE_OPTION" wallSurfLiningID="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="49" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="47" posInit="1" justify="1" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="0"><SKETCHCDATACHILD><![CDATA[WS]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHWALLSURFACE><SKETCHWALLSURFACE id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="50" dimCode="WS" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" side="0" color="-16777217" textureID="0" sheathing="" liningLayer="0" lingingBoard="NONE_OPTION" liningFinish="NONE_OPTION" wallSurfLiningID="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="51" color="-16777216" fontFace="Tahoma" fontSize="12" fontStyle="0" angle="0.0000000" namePosition="47" posInit="1" justify="1" flags="1" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="0"><SKETCHCDATACHILD><![CDATA[WS]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHWALLSURFACE></SKETCHSECTORWALL>`;
      }

      sectorsXML += `<SKETCHSECTOR id="SKT${sec.id}" exUuid="${generateExUuid()}" prevReadOrder="20" dimCode="${sec.dimCode}" abbrevNum="${sIdx + 1}" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" key="GRP0" grpType="1" parentKey="GRP1" grpDesc="" mainRoomID="0" lastDims="" wallIDs="${swIds.join(' ')}" floorHeight="0.0000000" ceilingType="0" ceilingColor="-16777217" floorColor="-16777217" ceilingTexture="0" textureID="0" ceilingHeight="8.0000000" flags="0" above="1" floorFrameOrient="0" floorConst="0" ffrmCenters="0" ffrmJoists="" ffrmRimBoard="" ffrmSheathing="" ffrmBeams="" ffrmDoBeams="0" slabThickness="508.0000000" slabIsReinforced="1" slabRebarSize="" slabVertSpacing="762.0000000" slabHorzSpacing="762.0000000" useRollCarpetFromHere="0" flooringMinFillCut="3048.0000000" flooringMinFillCutWidth="0.0000000" flooringSeamOverCut="381.0000000" flooringRoomOverCut="381.0000000" useScrap="1" useGroupFloorLayDir="0" maxFillPieces="4" autoELEDone="0" autoPLMDone="0" attachedRoof="0" castBeamBeamBlock="" castBeamInsulation="" castBeamSlab="" castBeamReinforce="" castBeamReinforceMesh="" castBeamFloorScreed="" latitude="0.0000000" longitude="0.0000000" carpetStartingWallID="0" waterMitZoneId="0" arCaptureDuration="0.0000000" arCapturedInAR="0" sortOrder="SKT0" hideMeasure="0" containRoomID="${containRoomId}" containWallID="0" preCustGrpContId="0" containWallSurface="0" containRoofFace="0" containWireFace="0" containExteriorSurface="0" isRefObj="${isBlock ? '1' : '0'}" autoStretch="1" hole="0" flooringHole="${isBlock ? '1' : '0'}" excludeAreaBehind="${isBlock ? '1' : '0'}" excludeLinearBehind="${isBlock ? '1' : '0'}" excludeFloorBehind="${isBlock ? '1' : '0'}" excludeLinearBehindCeiling="${isBlock ? '1' : '0'}" excludeCeilingAbove="${isBlock ? '1' : '0'}" orientation="44" sectorColor="-16777217" sectorTextureID="0" baseHeight="0.0000000" height="4572.0000000" newSymbolID="-1" symbolID="0" underStairs="0" slopeEq="0.0000000" imageType="0" piType="" imageInspectionImageId="" roofWireHoleID="0" wireFaceMarkedReplace="0" wireFaceUserMarkedReplace="0" equipmentDays="0.0000000" readingsClimateType="1" saturationMaterial="" saturationLocation="0" saturationHeight="0.0000000" saturationDryingStandard="0.0000000" readingsDoneCheckbox="0"><SKETCHLABEL id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="21" color="-16777216" fontFace="Tahoma" fontSize="10" fontStyle="5" angle="0.0000000" namePosition="45" posInit="1" justify="1" flags="3" multiline="0" roofAnnotation="0" geomniItemAnnotation="0" labelType="2"><SKETCHCDATACHILD><![CDATA[${sec.name}]]></SKETCHCDATACHILD></SKETCHLABEL></SKETCHSECTOR>`;
    });

    const lvlDimCode = sanitizeDimCode(lvl.name) || `LEVEL_${lIdx + 1}`;
    levelsXML += `<SKETCHLEVEL id="SKT${103 + lIdx}" exUuid="${levelUuid}" prevReadOrder="3" name="${lvl.name}" dimCode="${lvlDimCode}" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" key="${levelKey}" grpType="11" parentKey="GRP1" grpDesc="${lvl.name}" mainRoomID="0" lastDims="" levelNumber="${lvl.levelNumber}" floorElevation="${lvlFloorElevation}.0000000" copyExisting="1" aerialRoofsCreated="0" piImported="0" riImported="0" importID="0" importSource="" isExteriorLevel="0" hideLevelMeasurements="0" wireFaceGroupMode="0" levelLocked="0">${roomsXML}${wallsXML}${verticesXML}${sectorWallsXML}${sectorsXML}</SKETCHLEVEL>`;
  });

  const winDeductFlag = openingDefaults.windowDeductArea > 0 ? '1' : '0';
  const doorDeductFlag = openingDefaults.doorDeductArea > 0 ? '1' : '0';
  const missDeductFlag = openingDefaults.missingWallDeductArea > 0 ? '1' : '0';

  const docPrefs = `StartWithProposed:0;WallThickness:508;CeilingHeight:12192;ExtendSurfaceDown:1;ExtendSurfaceDownLength:1524;Grid:0;ShowGrid3D:0;ShowTerrain3D:0;GridSize:1524;SnapGrid:1;SnapGridSize:127;MergeSnap:1;MergeSnapDist:127;DisplayValidation:0;HideDimensionLines:0;ManualUpdateAlgorithm:0;RoofIntersectLevels:1;AddExtLevel:0;LevelElevation:152400;RemoveLFBehindBlcok:1;RemoveLFBehindBlockCeiling:1;RemoveSFBehindBlock:1;RemoveSFUnderBlock:1;RemoveSFAboveBlock:1;AutoCalcRoofWaste:0;AutoCalcRoofWasteNote:0;AutoCalcRoofWasteRidgeHipCap:0;AutoCalcRoofWasteStarter:0;AutoCalcRoofWasteRakeStarter:0;AutoCalcRoofWasteValleys:0;Window:0;WindowType:1;WindowShape:0;DoorType:0;DoorStyle:0;WindowHeight:6096;WindowWidth:7620;WindowDistanceFromFloor:4572;WindowDisplayGrid:1;WindowIgnoreOpening:0;WindowDeductOpening:${winDeductFlag};WindowUseFineTuneFeature:1;DoorHeight:10160;DoorWidth:3810;DoorDistanceFromFloor:0;DoorDouble:0;DoorIgnoreOpening:0;DoorDeductOpening:${doorDeductFlag};DoorAngle:20;DoorLeftHandSwing:0;DoorUseFineTuneFeature:1;MissingWallDeductOpening:${missDeductFlag};MissingWallIgnoreOpening:0;StairWidth:4572;StairDesiredRiserHeight:953;StairDesiredTreadWidth:1397;StairDefaultWallType:0;StairDefaultCeilingType:0;StairShowLabel:0;MaxFillPieces:4;MinFillCut:3048;MinFillCutWidth:3048;RollLengthOverCut:381;SeamAllowanceOvercut:381;UseScrap:1;StairOvercut:127`;

  return `<?xml version='1.0' encoding='UTF-8' ?><SKETCHDOCUMENT id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="0" dimCode="" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" key="GRP0" grpType="1" parentKey="GRP1" grpDesc="" mainRoomID="0" lastDims="" isSelectedDoc="0" majorVersion="1" minorVersion="27" buildNum="3400" compassRotation="0.0000000" geoLocation="0" geoLocationZone="0" fromPrevLoss="0" useTransition="0" roofsExcludeUngroupedValleys="0" createdVersion="127" documentPrefs="${docPrefs}" isManualFlooring="0" isCustomGroupsDisabled="0" allowImgInspElevMode="0"><SKETCHSTRUCTURE structureType="0" id="SKT${getNextId()}" exUuid="${generateExUuid()}" prevReadOrder="0" dimCode="" abbrevNum="0" dimLineItem="0" dimFixedWidth="0" dimPIMaterial="" dimPIAdditionalData="" dimPIItemCode="" dimPIDisplayName="" dimPIType="" dimScripterData="" dimCustGrpName="" dimCustGrpId="0" piElementType="" piElementViewType="" dimdialogCode="0" key="GRP0" grpType="1" parentKey="GRP0" grpDesc="" mainRoomID="0" lastDims="">${levelsXML}</SKETCHSTRUCTURE><COORDINATE3>${coordinates.join(' ')}</COORDINATE3></SKETCHDOCUMENT>`;
}