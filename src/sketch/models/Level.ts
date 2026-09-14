export type ShapeType = 'room' | 'line' | 'area' | 'block';

export interface ValidationIssue {
  field: string;
  message: string;
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
  isValid: boolean;
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

// ==========================================
// Point
// ==========================================
export class Point {
  constructor(public x: number = 0, public y: number = 0) {}

  distanceTo(other: Point): number {
    return Math.hypot(other.x - this.x, other.y - this.y);
  }

  equals(other: Point, tolerance: number = 1e-4): boolean {
    return this.distanceTo(other) <= tolerance;
  }

  clone(): Point {
    return new Point(this.x, this.y);
  }

  isOnSegment(a: Point, b: Point, tolerance: number = 0.25): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return this.distanceTo(a) < tolerance;

    const t = ((this.x - a.x) * dx + (this.y - a.y) * dy) / l2;
    if (t >= -0.05 && t <= 1.05) {
      const projX = a.x + t * dx;
      const projY = a.y + t * dy;
      return Math.hypot(this.x - projX, this.y - projY) < tolerance;
    }
    return false;
  }

  distanceToSegment(a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return this.distanceTo(a);

    let t = ((this.x - a.x) * dx + (this.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(this.x - (a.x + t * dx), this.y - (a.y + t * dy));
  }

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!Number.isFinite(this.x)) issues.push({ field: 'x', message: 'Coordinate x must be a finite number.' });
    if (!Number.isFinite(this.y)) issues.push({ field: 'y', message: 'Coordinate y must be a finite number.' });
    return issues;
  }
}

// ==========================================
// Opening
// ==========================================
export class Opening {
  public id: string;
  public widthFt: number;
  public heightFt: number;
  public lowerElevationFt: number;
  public relativeCenter: number;
  public label: string;
  public isWindow: boolean;
  public isDoor: boolean;
  public isMissingWall: boolean;

  constructor(init: Partial<Opening> = {}) {
    this.id = init.id ?? '';
    this.widthFt = init.widthFt ?? 3.0;
    this.heightFt = init.heightFt ?? 6.6667;
    this.lowerElevationFt = init.lowerElevationFt ?? 0;
    this.relativeCenter = init.relativeCenter ?? 0.5;
    this.label = init.label ?? '';
    this.isWindow = init.isWindow ?? false;
    this.isDoor = init.isDoor ?? false;
    this.isMissingWall = init.isMissingWall ?? false;
  }

  get topFt(): number {
    return this.lowerElevationFt + this.heightFt;
  }

  get areaSqFt(): number {
    return this.widthFt * this.heightFt;
  }

  isDeducted(thresholdSqFt: number): boolean {
    return thresholdSqFt === 0 || this.areaSqFt > thresholdSqFt;
  }

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!this.id.trim()) issues.push({ field: 'id', message: 'Opening ID cannot be empty.' });
    if (this.widthFt <= 0) issues.push({ field: 'widthFt', message: 'Opening width must be greater than 0.' });
    if (this.heightFt <= 0) issues.push({ field: 'heightFt', message: 'Opening height must be greater than 0.' });
    if (this.lowerElevationFt < 0) issues.push({ field: 'lowerElevationFt', message: 'Lower elevation cannot be negative.' });
    if (this.relativeCenter < 0 || this.relativeCenter > 1) {
      issues.push({ field: 'relativeCenter', message: 'relativeCenter must be between 0.0 and 1.0.' });
    }

    const typeCount = [this.isWindow, this.isDoor, this.isMissingWall].filter(Boolean).length;
    if (typeCount === 0) {
      issues.push({ field: 'type', message: 'Opening must be flagged as a window, door, or missing wall.' });
    } else if (typeCount > 1) {
      issues.push({ field: 'type', message: 'Opening cannot have multiple type flags enabled simultaneously.' });
    }
    return issues;
  }
}

// ==========================================
// WallMeta
// ==========================================
export class WallMeta {
  public id: string;
  public p0: Point;
  public p1: Point;
  public thicknessFt: number;
  public thicknessUnits: number;
  public thicknessInches: number;
  public centerLineBias?: number;
  public isInvisible: boolean;
  public openings: Opening[];

  constructor(init: Partial<WallMeta> = {}) {
    this.id = init.id ?? '';
    this.p0 = init.p0 ? new Point(init.p0.x, init.p0.y) : new Point();
    this.p1 = init.p1 ? new Point(init.p1.x, init.p1.y) : new Point();
    this.thicknessFt = init.thicknessFt ?? 4 / 12;
    this.thicknessUnits = init.thicknessUnits ?? 508;
    this.thicknessInches = init.thicknessInches ?? 4;
    this.centerLineBias = init.centerLineBias ?? 0.5;
    this.isInvisible = init.isInvisible ?? false;
    this.openings = (init.openings ?? []).map(op => (op instanceof Opening ? op : new Opening(op)));
  }

  get lengthFt(): number {
    return this.p0.distanceTo(this.p1);
  }

  isPointOnWall(pt: Point, tol: number = 0.25): boolean {
    return pt.isOnSegment(this.p0, this.p1, tol);
  }

  findOverlappingOpenings(): Array<[Opening, Opening]> {
    const overlaps: Array<[Opening, Opening]> = [];
    const len = this.lengthFt;
    if (len <= 0) return overlaps;

    const intervals = this.openings.map(op => {
      const centerDist = op.relativeCenter * len;
      const halfW = op.widthFt / 2;
      return {
        op,
        start: centerDist - halfW,
        end: centerDist + halfW,
        bot: op.lowerElevationFt,
        top: op.topFt
      };
    });

    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const a = intervals[i];
        const b = intervals[j];
        const horizOverlap = a.start < b.end - 1e-4 && b.start < a.end - 1e-4;
        const vertOverlap = a.bot < b.top - 1e-4 && b.bot < a.top - 1e-4;

        if (horizOverlap && vertOverlap) {
          overlaps.push([a.op, b.op]);
        }
      }
    }
    return overlaps;
  }

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!this.id.trim()) issues.push({ field: 'id', message: 'WallMeta ID cannot be empty.' });
    issues.push(...this.p0.validate().map(i => ({ ...i, field: `p0.${i.field}` })));
    issues.push(...this.p1.validate().map(i => ({ ...i, field: `p1.${i.field}` })));

    const wallLen = this.lengthFt;
    if (wallLen <= 1e-4) {
      issues.push({ field: 'length', message: 'Wall segment length cannot be 0.' });
    }

    if (this.thicknessFt < 0 || this.thicknessUnits < 0 || this.thicknessInches < 0) {
      issues.push({ field: 'thickness', message: 'Wall thickness cannot be negative.' });
    }

    this.openings.forEach((op, idx) => {
      issues.push(...op.validate().map(i => ({ ...i, field: `openings[${idx}].${i.field}` })));
      if (wallLen > 0 && op.widthFt > wallLen + 1e-4) {
        issues.push({
          field: `openings[${idx}].widthFt`,
          message: `Opening "${op.label || op.id}" (${op.widthFt} ft) exceeds wall length (${wallLen.toFixed(2)} ft).`
        });
      }
    });

    const overlaps = this.findOverlappingOpenings();
    overlaps.forEach(([opA, opB]) => {
      issues.push({
        field: 'openings',
        message: `Openings "${opA.label || opA.id}" and "${opB.label || opB.id}" physically collide on wall ${this.id}.`
      });
    });

    return issues;
  }
}

// ==========================================
// StubWall
// ==========================================
export class StubWall {
  public id: string;
  public p0: Point;
  public p1: Point;
  public meta?: WallMeta;

  constructor(init: Partial<StubWall> = {}) {
    this.id = init.id ?? '';
    this.p0 = init.p0 ? new Point(init.p0.x, init.p0.y) : new Point();
    this.p1 = init.p1 ? new Point(init.p1.x, init.p1.y) : new Point();
    this.meta = init.meta ? (init.meta instanceof WallMeta ? init.meta : new WallMeta(init.meta)) : undefined;
  }

  get lengthFt(): number {
    return this.p0.distanceTo(this.p1);
  }

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (!this.id.trim()) issues.push({ field: 'id', message: 'StubWall ID cannot be empty.' });
    if (this.lengthFt <= 1e-4) issues.push({ field: 'length', message: 'StubWall length cannot be 0.' });
    if (this.meta) {
      issues.push(...this.meta.validate().map(i => ({ ...i, field: `meta.${i.field}` })));
    }
    return issues;
  }
}

// ==========================================
// Shape
// ==========================================
export class Shape {
  public id: number;
  public levelId: number;
  public type: ShapeType;
  public name: string;
  public dimCode: string;
  public isDimCodeManual: boolean;
  public ceilingHeightFt: number;
  public points: Point[];
  public stubWalls: StubWall[];

  constructor(init: Partial<Shape> = {}) {
    this.id = init.id ?? 0;
    this.levelId = init.levelId ?? 1;
    this.type = init.type ?? 'room';
    this.name = init.name ?? '';
    this.dimCode = init.dimCode ?? Shape.sanitizeDimCode(this.name);
    this.isDimCodeManual = init.isDimCodeManual ?? false;
    this.ceilingHeightFt = init.ceilingHeightFt ?? 8.0;
    this.points = (init.points ?? []).map(p => (p instanceof Point ? p : new Point(p.x, p.y)));
    this.stubWalls = (init.stubWalls ?? []).map(sw => (sw instanceof StubWall ? sw : new StubWall(sw)));
  }

  static sanitizeDimCode(val: string): string {
    if (!val) return '';
    return val.toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').substring(0, 10);
  }

  // --- Geometric Checks & Operations ---

  /**
   * Computes the signed polygon area using the shoelace formula.
   * In standard screen coordinates (y-down), negative area denotes clockwise winding.
   */
  getSignedArea(): number {
    const n = this.points.length;
    if (n < 3) return 0;
    let a = 0.0;
    for (let i = 0; i < n; i++) {
      const p1 = this.points[i];
      const p2 = this.points[(i + 1) % n];
      a += (p1.x * p2.y - p2.x * p1.y);
    }
    return a / 2.0;
  }

  /**
   * Evaluates if the polygon points follow a clockwise winding path.
   */
  isClockwise(): boolean {
    return this.getSignedArea() < 0;
  }

  /**
   * Mutates the vertex array to match the requested winding order[cite: 1].
   * Returns `this` for chaining.
   */
  enforceWindingOrder(targetClockwise: boolean = true): this {
    if (this.type === 'line' || this.points.length < 3) return this;
    const isCw = this.isClockwise();
    if (targetClockwise !== isCw) {
      this.points.reverse();
    }
    return this;
  }

  /**
   * Ray-casting point-in-polygon containment test[cite: 1].
   */
  containsPoint(pt: Point): boolean {
    if (this.type === 'line' || this.points.length < 3) return false;

    let inside = false;
    const poly = this.points;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > pt.y) !== (yj > pt.y)) && 
                        (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  getCentroid(): Point {
    if (this.points.length === 0) return new Point(0, 0);
    let x = 0;
    let y = 0;
    for (const p of this.points) {
      x += p.x;
      y += p.y;
    }
    return new Point(x / this.points.length, y / this.points.length);
  }

  // --- Domain Verification ---

  checkCeilingViolations(metaLookup?: (p0: Point, p1: Point) => WallMeta | undefined): RoomCeilingReport {
    if (this.type !== 'room') {
      return { maxTop: 0, violations: [], ceilFt: this.ceilingHeightFt, isValid: true };
    }

    const ceilFt = this.ceilingHeightFt || 8.0;
    let maxTop = 0;
    const violations: CeilingViolation[] = [];

    const inspectOpenings = (meta?: WallMeta) => {
      if (!meta?.openings) return;
      meta.openings.forEach(op => {
        const topFt = op.topFt;
        if (topFt > maxTop) maxTop = topFt;
        if (topFt > ceilFt + 0.001) {
          violations.push({
            op,
            label: op.label || (op.isWindow ? 'Window' : (op.isDoor ? 'Door' : 'Opening')),
            topFt,
            baseFt: op.lowerElevationFt,
            heightFt: op.heightFt,
            diffFt: topFt - ceilFt
          });
        }
      });
    };

    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      const p0 = this.points[i];
      const p1 = this.points[(i + 1) % n];
      const meta = metaLookup ? metaLookup(p0, p1) : undefined;
      inspectOpenings(meta);
    }

    this.stubWalls.forEach(sw => inspectOpenings(sw.meta));

    return {
      maxTop,
      violations,
      ceilFt,
      isValid: violations.length === 0
    };
  }

  /**
   * Validates state, geometry bounds, and self-consistency.
   * If `requireClockwise` is passed, winding order is checked as well.
   */
  validate(requireClockwise?: boolean): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (this.id <= 0) issues.push({ field: 'id', message: 'Shape ID must be positive.' });
    if (!this.name.trim()) issues.push({ field: 'name', message: 'Shape name cannot be empty.' });

    if (!/^[A-Z0-9_]{1,10}$/.test(this.dimCode)) {
      issues.push({ field: 'dimCode', message: 'dimCode must be 1-10 uppercase alphanumeric or underscore chars.' });
    }

    if (this.type === 'line') {
      if (this.points.length < 2) {
        issues.push({ field: 'points', message: 'A line must contain at least 2 points.' });
      }
    } else {
      if (this.points.length < 3) {
        issues.push({ field: 'points', message: `${this.type} must contain at least 3 vertices.` });
      } else {
        const area = Math.abs(this.getSignedArea());
        if (area < 1e-3) {
          issues.push({ field: 'points', message: `${this.type} polygon area cannot be degenerate or zero.` });
        }
        if (requireClockwise !== undefined && this.isClockwise() !== requireClockwise) {
          issues.push({
            field: 'windingOrder',
            message: `Expected ${requireClockwise ? 'clockwise' : 'counter-clockwise'} winding, but found opposite.`
          });
        }
      }
    }

    if (this.type === 'room' && this.ceilingHeightFt <= 0) {
      issues.push({ field: 'ceilingHeightFt', message: 'Ceiling height must be greater than 0.' });
    }

    this.stubWalls.forEach((sw, idx) => {
      issues.push(...sw.validate().map(i => ({ ...i, field: `stubWalls[${idx}].${i.field}` })));
    });

    return issues;
  }
}

// ==========================================
// Level
// ==========================================
export class Level {
  public id: number;
  public name: string;
  public levelNumber: number;

  constructor(init: Partial<Level> = {}) {
    this.id = init.id ?? 1;
    this.name = init.name ?? 'Level 1';
    this.levelNumber = init.levelNumber ?? 1;
  }

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (this.id <= 0) issues.push({ field: 'id', message: 'Level ID must be positive.' });
    if (!this.name.trim()) issues.push({ field: 'name', message: 'Level name cannot be empty.' });
    if (this.levelNumber < 1) issues.push({ field: 'levelNumber', message: 'Level number must be at least 1.' });
    return issues;
  }
}

// ==========================================
// OpeningDefaults
// ==========================================
export class OpeningDefaults {
  public doorDeductArea: number;
  public windowDeductArea: number;
  public missingWallDeductArea: number;

  constructor(init: Partial<OpeningDefaults> = {}) {
    this.doorDeductArea = Math.max(0, init.doorDeductArea ?? 0);
    this.windowDeductArea = Math.max(0, init.windowDeductArea ?? 0);
    this.missingWallDeductArea = Math.max(0, init.missingWallDeductArea ?? 0);
  }

  validate(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (this.doorDeductArea < 0) issues.push({ field: 'doorDeductArea', message: 'Deduct area cannot be negative.' });
    if (this.windowDeductArea < 0) issues.push({ field: 'windowDeductArea', message: 'Deduct area cannot be negative.' });
    if (this.missingWallDeductArea < 0) issues.push({ field: 'missingWallDeductArea', message: 'Deduct area cannot be negative.' });
    return issues;
  }
}