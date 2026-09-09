export interface Point {
  x: number;
  y: number;
}

export interface Opening {
  id: string;
  widthFt: number;
  heightFt: number;
  lowerElevationFt: number;
  relativeCenter: number;
  label: string;
  isWindow: boolean;
  isDoor: boolean;
  isMissingWall: boolean;
}

export interface WallMeta {
  id: string;
  p0: Point;
  p1: Point;
  thicknessFt: number;
  thicknessUnits: number;
  thicknessInches: number;
  centerLineBias?: number;
  isInvisible: boolean;
  openings: Opening[];
}

export interface StubWall {
  id: string;
  p0: Point;
  p1: Point;
  meta?: WallMeta;
}

export type ShapeType = 'room' | 'line' | 'area' | 'block';

export interface Shape {
  id: number;
  levelId: number;
  type: ShapeType;
  name: string;
  dimCode: string;
  isDimCodeManual: boolean;
  ceilingHeightFt: number;
  points: Point[];
  stubWalls?: StubWall[];
}

export interface Level {
  id: number;
  name: string;
  levelNumber: number;
}

export interface OpeningDefaults {
  doorDeductArea: number;
  windowDeductArea: number;
  missingWallDeductArea: number;
}

export interface CeilingViolation {
  op: Opening;
  label: string;
  topFt: number;
  baseFt: number;
  heightFt: number;
  diffFt: number;
}

export interface RoomCeilingReport {
  maxTop: number;
  violations: CeilingViolation[];
  ceilFt: number;
}

export interface RoomCeilingViolationSummary {
  room: Shape;
  levelName: string;
  ceilFt: number;
  maxTop: number;
  violations: CeilingViolation[];
}

export interface InteriorWindowViolation {
  metaId: string;
  opId: string;
  op: Opening;
  meta: WallMeta;
  levelId: number;
  levelName: string;
  rooms: Shape[];
}