import type { Shape, Level, WallMeta, OpeningDefaults, Point, ShapeType } from './types';
import type { SelectedEdge } from './viewer';
import { sanitizeDimCode, snapToInch } from './geometry';

export interface SplitState {
  isSplitMode: boolean;
  firstCorner: { pt: Point; candidates: Array<{ shape: Shape; index: number; pt: Point }> } | null;
  pendingData: { originalRoom: Shape; poly1: Point[]; poly2: Point[] } | null;
}

export type ActiveModal =
  | null
  | 'defaults'
  | 'deductWarning'
  | 'ceilingWarning'
  | 'interiorWindow'
  | 'splitConfirm'
  | 'import'
  | 'export';

class SketchStore {
  public levels: Level[] = [{ id: 1, name: 'Main Level', levelNumber: 1 }];
  public currentLevelId = 1;
  public shapes: Shape[] = [];
  public wallMetadataList: WallMeta[] = [];
  public openingDefaults: OpeningDefaults = {
    doorDeductArea: 0.0,
    windowDeductArea: 0.0,
    missingWallDeductArea: 0.0,
  };

  public selectedShapeId: number | null = null;
  public selectedEdge: SelectedEdge | null = null;
  public showUnderlay = true;
  public activeModal: ActiveModal = null;
  public filename = 'MultiFloorTemplate';

  public splitState: SplitState = {
    isSplitMode: false,
    firstCorner: null,
    pendingData: null,
  };

  private idSeed = 3000;
  private levelIdSeed = 2;
  private listeners: Set<() => void> = new Set();

  public getNextId = (): number => this.idSeed++;
  public getNextLevelId = (): number => this.levelIdSeed++;

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public getActiveShapes(): Shape[] {
    return this.shapes.filter((s) => s.levelId === this.currentLevelId);
  }

  public selectShape(id: number | null): void {
    this.selectedShapeId = id;
    if (!id) this.selectedEdge = null;
    this.notify();
  }

  public selectEdge(edge: SelectedEdge | null): void {
    this.selectedEdge = edge;
    if (edge) this.selectedShapeId = edge.shapeId;
    this.notify();
  }

  public switchLevel(id: number): void {
    this.currentLevelId = id;
    this.selectedShapeId = null;
    this.selectedEdge = null;
    this.exitSplitMode();
    this.notify();
  }

  public addLevel(name?: string): void {
    const num = this.levels.length + 1;
    const newLvl: Level = {
      id: this.getNextLevelId(),
      name: name || `Level ${num}`,
      levelNumber: num,
    };
    this.levels.push(newLvl);
    this.switchLevel(newLvl.id);
  }

  public deleteCurrentLevel(): void {
    if (this.levels.length <= 1) {
      alert('At least one floor level is required.');
      return;
    }
    const curr = this.levels.find((l) => l.id === this.currentLevelId);
    if (!confirm(`Delete ${curr?.name} and all its shapes?`)) return;

    this.shapes = this.shapes.filter((s) => s.levelId !== this.currentLevelId);
    this.levels = this.levels.filter((l) => l.id !== this.currentLevelId);
    this.levels.forEach((l, idx) => (l.levelNumber = idx + 1));
    this.switchLevel(this.levels[0].id);
  }

  public addShape(type: ShapeType, center: Point): void {
    this.exitSplitMode();
    const count = this.getActiveShapes().filter((s) => s.type === type).length + 1;
    const names: Record<ShapeType, string> = { room: 'Room', line: 'RefLine', area: 'Area', block: 'Block' };
    const name = `${names[type]} ${count}`;
    const id = this.getNextId();
    const cx = snapToInch(center.x);
    const cy = snapToInch(center.y);

    let points: Point[] = [];
    if (type === 'room') {
      points = [
        { x: cx - 6, y: cy - 6 },
        { x: cx + 6, y: cy - 6 },
        { x: cx + 6, y: cy + 6 },
        { x: cx - 6, y: cy + 6 },
      ];
    } else if (type === 'line') {
      points = [{ x: cx - 1, y: cy }, { x: cx + 1, y: cy }];
    } else {
      points = [
        { x: cx - 1, y: cy - 1 },
        { x: cx + 1, y: cy - 1 },
        { x: cx + 1, y: cy + 1 },
        { x: cx - 1, y: cy + 1 },
      ];
    }

    this.shapes.push({
      id,
      levelId: this.currentLevelId,
      type,
      name,
      dimCode: sanitizeDimCode(name),
      isDimCodeManual: false,
      ceilingHeightFt: 8.0,
      points,
      stubWalls: [],
    });

    this.selectedEdge = null;
    this.selectedShapeId = id;
    this.notify();
  }

  public deleteSelectedShape(): void {
    if (!this.selectedShapeId) return;
    this.shapes = this.shapes.filter((s) => s.id !== this.selectedShapeId);
    this.selectedShapeId = null;
    this.selectedEdge = null;
    this.notify();
  }

  public changeOpeningType(metaId: string, opId: string, newType: string): void {
    const meta = this.wallMetadataList.find((m) => m.id === metaId);
    if (!meta || !meta.openings) return;
    const op = meta.openings.find((o) => o.id === opId);
    if (!op) return;

    op.isDoor = newType === 'door';
    op.isWindow = newType === 'window';
    op.isMissingWall = newType === 'opening';
    op.label = op.isDoor ? 'Door' : op.isWindow ? 'Window' : 'Opening';
    this.notify();
  }

  public exitSplitMode(): void {
    this.splitState = { isSplitMode: false, firstCorner: null, pendingData: null };
    this.notify();
  }
}

export const store = new SketchStore();