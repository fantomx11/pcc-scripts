import type { Point, Shape, Level, WallMeta } from './types';
import {
  snapToInch,
  formatFtIn,
  getCentroid,
  isPointInsidePoly,
} from './geometry';
import { getRoomCeilingViolations, findWallMeta } from './validators/ceilingValidator';

export const BASE_FT_TO_PX = 20;
export const SNAP_DISTANCE_PX = 14;

export interface SelectedEdge {
  shapeId: number;
  edgeIndex: number;
}

export interface DraggedVertex {
  shapeId: number;
  index: number;
}

export interface DraggedShape {
  shapeId: number;
  startWorld: Point;
  initialPoints: Point[];
  initialStubs?: Array<{ p0: Point; p1: Point; meta?: WallMeta }>;
}

export interface ViewerContext {
  getShapes: () => Shape[];
  getLevels: () => Level[];
  getCurrentLevelId: () => number;
  getWallMetadata: () => WallMeta[];
  getSelectedShapeId: () => number | null;
  getSelectedEdge: () => SelectedEdge | null;
  shouldShowUnderlay: () => boolean;
}

export class SketchViewer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public zoom = 1.0;
  public panX = 150;
  public panY = 150;
  public isPanning = false;
  public isSpacePressed = false;
  public isCtrlHeld = false;
  public lastMouse: Point = { x: 0, y: 0 };

  public hoveredVertex: DraggedVertex | null = null;
  public draggedVertex: DraggedVertex | null = null;
  public draggedShape: DraggedShape | null = null;
  public activeSnapTarget: Point | null = null;

  public primaryGuideMode = 0;
  public secondaryGuideMode = 0;
  public constraintAnchor: Point | null = null;

  private ctxProvider: ViewerContext;

  constructor(canvas: HTMLCanvasElement, contextProvider: ViewerContext) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctxProvider = contextProvider;
  }

  public resize(): void {
    if (!this.canvas.parentElement) return;
    this.canvas.width = this.canvas.parentElement.clientWidth;
    this.canvas.height = this.canvas.parentElement.clientHeight;
    this.draw();
  }

  public worldToScreen(pt: Point): Point {
    return {
      x: pt.x * BASE_FT_TO_PX * this.zoom + this.panX,
      y: pt.y * BASE_FT_TO_PX * this.zoom + this.panY,
    };
  }

  public screenToWorld(sx: number, sy: number): Point {
    return {
      x: (sx - this.panX) / (BASE_FT_TO_PX * this.zoom),
      y: (sy - this.panY) / (BASE_FT_TO_PX * this.zoom),
    };
  }

  public adjustZoom(factor: number, centerScreenX = this.canvas.width / 2, centerScreenY = this.canvas.height / 2): void {
    const prevWorld = this.screenToWorld(centerScreenX, centerScreenY);
    this.zoom = Math.max(0.05, Math.min(8.0, this.zoom * factor));
    this.panX = centerScreenX - prevWorld.x * BASE_FT_TO_PX * this.zoom;
    this.panY = centerScreenY - prevWorld.y * BASE_FT_TO_PX * this.zoom;
    this.draw();
  }

  public resetView(): void {
    this.zoom = 1.0;
    const shapes = this.ctxProvider.getShapes();
    const currentLvlId = this.ctxProvider.getCurrentLevelId();
    const active = shapes.filter((s) => s.levelId === currentLvlId);
    const pool = active.length > 0 ? active : shapes;

    if (pool.length === 0) {
      this.panX = 150;
      this.panY = 150;
    } else {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      pool.forEach((s) => {
        s.points.forEach((p) => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        });
        (s.stubWalls || []).forEach((sw) => {
          minX = Math.min(minX, sw.p0.x, sw.p1.x);
          maxX = Math.max(maxX, sw.p0.x, sw.p1.x);
          minY = Math.min(minY, sw.p0.y, sw.p1.y);
          maxY = Math.max(maxY, sw.p0.y, sw.p1.y);
        });
      });

      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      this.panX = this.canvas.width / 2 - midX * BASE_FT_TO_PX * this.zoom;
      this.panY = this.canvas.height / 2 - midY * BASE_FT_TO_PX * this.zoom;
    }
    this.draw();
  }

  public rotateCurrentLevel180(): void {
    const currentLvlId = this.ctxProvider.getCurrentLevelId();
    const active = this.ctxProvider.getShapes().filter((s) => s.levelId === currentLvlId);
    if (active.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    active.forEach((s) => {
      s.points.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
      (s.stubWalls || []).forEach((sw) => {
        minX = Math.min(minX, sw.p0.x, sw.p1.x);
        maxX = Math.max(maxX, sw.p0.x, sw.p1.x);
        minY = Math.min(minY, sw.p0.y, sw.p1.y);
        maxY = Math.max(maxY, sw.p0.y, sw.p1.y);
      });
    });

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    active.forEach((shape) => {
      shape.points = shape.points.map((p) => ({
        x: snapToInch(2 * cx - p.x),
        y: snapToInch(2 * cy - p.y),
      }));
      if (shape.stubWalls) {
        shape.stubWalls.forEach((sw) => {
          sw.p0 = { x: snapToInch(2 * cx - sw.p0.x), y: snapToInch(2 * cy - sw.p0.y) };
          sw.p1 = { x: snapToInch(2 * cx - sw.p1.x), y: snapToInch(2 * cy - sw.p1.y) };
        });
      }
    });

    this.draw();
  }

  public findVertexUnderMouse(mx: number, my: number): DraggedVertex | null {
    const currentLvlId = this.ctxProvider.getCurrentLevelId();
    const active = this.ctxProvider.getShapes().filter((s) => s.levelId === currentLvlId);

    for (const shape of active) {
      for (let i = 0; i < shape.points.length; i++) {
        const sp = this.worldToScreen(shape.points[i]);
        if (Math.hypot(sp.x - mx, sp.y - my) <= 9) {
          return { shapeId: shape.id, index: i };
        }
      }
    }
    return null;
  }

  public findEdgeUnderMouse(mx: number, my: number): SelectedEdge | null {
    const currentLvlId = this.ctxProvider.getCurrentLevelId();
    const active = this.ctxProvider.getShapes().filter((s) => s.levelId === currentLvlId);

    for (const shape of active) {
      const pts = shape.points.map((p) => this.worldToScreen(p));
      const count = shape.type === 'line' ? pts.length - 1 : pts.length;
      for (let i = 0; i < count; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        if (this.distToSegment({ x: mx, y: my }, p1, p2) <= 10) {
          return { shapeId: shape.id, edgeIndex: i };
        }
      }
    }
    return null;
  }

  public findShapeBodyUnderMouse(mx: number, my: number): Shape | null {
    const worldPt = this.screenToWorld(mx, my);
    const currentLvlId = this.ctxProvider.getCurrentLevelId();
    const active = this.ctxProvider.getShapes().filter((s) => s.levelId === currentLvlId);

    for (let i = active.length - 1; i >= 0; i--) {
      const shape = active[i];
      if (shape.type === 'line') {
        const pts = shape.points.map((p) => this.worldToScreen(p));
        for (let j = 0; j < pts.length - 1; j++) {
          if (this.distToSegment({ x: mx, y: my }, pts[j], pts[j + 1]) <= 8) return shape;
        }
      } else {
        if (isPointInsidePoly(worldPt, shape.points)) return shape;
      }
    }
    return null;
  }

  public getSnapCoordinate(candidatePt: Point, ignoreShapeId: number, ignoreIndex: number): { point: Point; isCornerSnap: boolean } {
    let closestDist = SNAP_DISTANCE_PX;
    let snapPt: Point | null = null;
    const candScreen = this.worldToScreen(candidatePt);

    const currentLvlId = this.ctxProvider.getCurrentLevelId();
    const active = this.ctxProvider.getShapes().filter((s) => s.levelId === currentLvlId);

    active.forEach((shape) => {
      shape.points.forEach((pt, idx) => {
        if (shape.id === ignoreShapeId && idx === ignoreIndex) return;
        const sp = this.worldToScreen(pt);
        const d = Math.hypot(sp.x - candScreen.x, sp.y - candScreen.y);
        if (d < closestDist) {
          closestDist = d;
          snapPt = { x: pt.x, y: pt.y };
        }
      });
    });

    if (snapPt) return { point: snapPt, isCornerSnap: true };
    return {
      point: { x: snapToInch(candidatePt.x), y: snapToInch(candidatePt.y) },
      isCornerSnap: false,
    };
  }

  public draw(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();

    const shapes = this.ctxProvider.getShapes();
    const currentLvlId = this.ctxProvider.getCurrentLevelId();
    const wallMetadata = this.ctxProvider.getWallMetadata();
    const selectedShapeId = this.ctxProvider.getSelectedShapeId();
    const selectedEdge = this.ctxProvider.getSelectedEdge();

    if (this.ctxProvider.shouldShowUnderlay()) {
      const otherShapes = shapes.filter((s) => s.levelId !== currentLvlId);
      otherShapes.forEach((shape) => {
        const pts = shape.points.map((p) => this.worldToScreen(p));
        this.ctx.beginPath();
        if (pts.length > 0) {
          this.ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i].x, pts[i].y);
          if (shape.type !== 'line') this.ctx.closePath();
        }
        this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      });
    }

    const active = shapes.filter((s) => s.levelId === currentLvlId);
    active.forEach((shape) => {
      const isSelected = shape.id === selectedShapeId;
      const pts = shape.points.map((p) => this.worldToScreen(p));

      const isRoom = shape.type === 'room';
      const ceilCheck = isRoom ? getRoomCeilingViolations(shape, wallMetadata) : { violations: [] };
      const hasViolation = ceilCheck.violations.length > 0;

      this.ctx.beginPath();
      if (pts.length > 0) {
        this.ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i].x, pts[i].y);
        if (shape.type !== 'line') this.ctx.closePath();
      }

      let strokeColor = '#38bdf8';
      let fillColor = 'rgba(56, 189, 248, 0.15)';
      if (shape.type === 'line') strokeColor = '#f472b6';
      if (shape.type === 'area') { strokeColor = '#4ade80'; fillColor = 'rgba(74, 222, 128, 0.15)'; }
      if (shape.type === 'block') { strokeColor = '#facc15'; fillColor = 'rgba(250, 204, 21, 0.2)'; }

      if (hasViolation) {
        strokeColor = '#ef4444';
        fillColor = 'rgba(239, 68, 68, 0.22)';
      }

      if (shape.type !== 'line') {
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();
      }
      this.ctx.lineWidth = isSelected ? 3 : 1.5;
      this.ctx.strokeStyle = strokeColor;
      this.ctx.stroke();

      const loopCount = shape.type === 'line' ? pts.length - 1 : pts.length;
      for (let i = 0; i < loopCount; i++) {
        const p1 = shape.points[i];
        const p2 = shape.points[(i + 1) % shape.points.length];
        const isThisEdgeSelected =
          Boolean(selectedEdge && selectedEdge.shapeId === shape.id && selectedEdge.edgeIndex === i);
        this.drawEdgeWithMeta(p1, p2, isThisEdgeSelected, strokeColor, wallMetadata);
      }

      if (shape.stubWalls && shape.stubWalls.length > 0) {
        shape.stubWalls.forEach((sw) => {
          this.ctx.beginPath();
          const sp0 = this.worldToScreen(sw.p0);
          const sp1 = this.worldToScreen(sw.p1);
          this.ctx.moveTo(sp0.x, sp0.y);
          this.ctx.lineTo(sp1.x, sp1.y);
          this.ctx.lineWidth = isSelected ? 3.5 : 2.5;
          this.ctx.strokeStyle = strokeColor;
          this.ctx.stroke();
          this.drawEdgeWithMeta(sw.p0, sw.p1, false, strokeColor, wallMetadata);

          this.ctx.beginPath();
          this.ctx.arc(sp1.x, sp1.y, 4, 0, Math.PI * 2);
          this.ctx.fillStyle = '#f59e0b';
          this.ctx.fill();
        });
      }

      const center = getCentroid(pts);
      this.ctx.fillStyle = strokeColor;
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(shape.name, center.x, center.y - 8);
      this.ctx.font = '10px monospace';
      this.ctx.fillStyle = '#94a3b8';
      this.ctx.fillText(
        `[${shape.dimCode}]${shape.ceilingHeightFt ? ` ${shape.ceilingHeightFt}'` : ''}`,
        center.x,
        center.y + 8
      );

      if (hasViolation) {
        this.ctx.fillStyle = '#ef4444';
        this.ctx.font = 'bold 9px monospace';
        this.ctx.fillText(
          `⚠️ Ceil ${formatFtIn(ceilCheck.ceilFt!)} < Req ${formatFtIn(ceilCheck.maxTop)}`,
          center.x,
          center.y + 22
        );
      }

      pts.forEach((pt, idx) => {
        const isHovered =
          Boolean(this.hoveredVertex && this.hoveredVertex.shapeId === shape.id && this.hoveredVertex.index === idx);

        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, isHovered ? 6 : 4.5, 0, Math.PI * 2);
        this.ctx.fillStyle = isHovered ? '#f43f5e' : '#ffffff';
        this.ctx.fill();
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = strokeColor;
        this.ctx.stroke();
      });
    });

    if (this.draggedVertex) {
      const shape = shapes.find((s) => s.id === this.draggedVertex!.shapeId);
      if (shape && shape.points[this.draggedVertex.index]) {
        const pt = shape.points[this.draggedVertex.index];
        const sp = this.worldToScreen(pt);
        const L = Math.max(this.canvas.width, this.canvas.height) * 2.5;

        const drawGuideLine = (mode: number, isConstraining: boolean, isSecondary = false) => {
          if (mode === 0) return;
          this.ctx.save();
          if (isConstraining) {
            this.ctx.strokeStyle = '#facc15';
            this.ctx.lineWidth = 1.6;
            this.ctx.setLineDash([6, 4]);
          } else {
            this.ctx.strokeStyle = isSecondary ? 'rgba(244, 114, 182, 0.85)' : 'rgba(56, 189, 248, 0.85)';
            this.ctx.lineWidth = 1.2;
            this.ctx.setLineDash([4, 4]);
          }

          this.ctx.beginPath();
          if (mode === 1) {
            this.ctx.moveTo(0, sp.y); this.ctx.lineTo(this.canvas.width, sp.y);
          } else if (mode === 2) {
            this.ctx.moveTo(sp.x - L, sp.y - L); this.ctx.lineTo(sp.x + L, sp.y + L);
          } else if (mode === 3) {
            this.ctx.moveTo(sp.x, 0); this.ctx.lineTo(sp.x, this.canvas.height);
          } else if (mode === 4) {
            this.ctx.moveTo(sp.x - L, sp.y + L); this.ctx.lineTo(sp.x + L, sp.y - L);
          }
          this.ctx.stroke();
          this.ctx.restore();
        };

        const isConstraining = this.isCtrlHeld && this.primaryGuideMode !== 0;
        if (this.primaryGuideMode !== 0) drawGuideLine(this.primaryGuideMode, isConstraining, false);
        if (this.secondaryGuideMode !== 0) drawGuideLine(this.secondaryGuideMode, false, true);
      }
    }

    if (this.activeSnapTarget) {
      const sp = this.worldToScreen(this.activeSnapTarget);
      this.ctx.beginPath();
      this.ctx.arc(sp.x, sp.y, 10, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#ec4899';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([4, 3]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
  }

  private drawGrid(): void {
    const gridSpacing1Ft = BASE_FT_TO_PX * this.zoom;
    const startX = this.panX % gridSpacing1Ft;
    const startY = this.panY % gridSpacing1Ft;

    this.ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
    this.ctx.lineWidth = 1;

    for (let x = startX; x < this.canvas.width; x += gridSpacing1Ft) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke();
    }
    for (let y = startY; y < this.canvas.height; y += gridSpacing1Ft) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); this.ctx.stroke();
    }
  }

  private drawEdgeWithMeta(
    p1: Point,
    p2: Point,
    isSelected: boolean,
    _shapeColor: string,
    wallMetaList: WallMeta[]
  ): void {
    const sp1 = this.worldToScreen(p1);
    const sp2 = this.worldToScreen(p2);
    const meta = findWallMeta(p1, p2, wallMetaList);

    if (meta && meta.isInvisible) {
      this.ctx.beginPath();
      this.ctx.moveTo(sp1.x, sp1.y);
      this.ctx.lineTo(sp2.x, sp2.y);
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeStyle = '#94a3b8';
      this.ctx.setLineDash([5, 5]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    if (meta && meta.openings && meta.openings.length > 0) {
      meta.openings.forEach((op) => {
        const rc = op.relativeCenter !== undefined ? op.relativeCenter : 0.5;
        const wFt = op.widthFt || 3.0;
        const edgeLenFt = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        const origDx = meta.p1.x - meta.p0.x;
        const origDy = meta.p1.y - meta.p0.y;
        const cWorldX = meta.p0.x + rc * origDx;
        const cWorldY = meta.p0.y + rc * origDy;

        const segDx = p2.x - p1.x;
        const segDy = p2.y - p1.y;
        const segL2 = segDx * segDx + segDy * segDy;
        let tCenter = 0.5;
        if (segL2 > 1e-6) {
          tCenter = ((cWorldX - p1.x) * segDx + (cWorldY - p1.y) * segDy) / segL2;
        }

        const dt = wFt / 2 / (edgeLenFt || 1);
        const t1 = Math.max(0, tCenter - dt);
        const t2 = Math.min(1, tCenter + dt);

        const opScreen1 = { x: sp1.x + t1 * (sp2.x - sp1.x), y: sp1.y + t1 * (sp2.y - sp1.y) };
        const opScreen2 = { x: sp1.x + t2 * (sp2.x - sp1.x), y: sp1.y + t2 * (sp2.y - sp1.y) };

        this.ctx.beginPath();
        this.ctx.moveTo(opScreen1.x, opScreen1.y);
        this.ctx.lineTo(opScreen2.x, opScreen2.y);
        this.ctx.lineWidth = 4.5;

        if (op.isWindow) {
          this.ctx.strokeStyle = '#38bdf8';
        } else if (op.isDoor) {
          this.ctx.strokeStyle = '#f97316';
        } else {
          this.ctx.strokeStyle = '#a855f7';
        }
        this.ctx.stroke();
      });
    }

    if (isSelected) {
      this.ctx.beginPath();
      this.ctx.moveTo(sp1.x, sp1.y);
      this.ctx.lineTo(sp2.x, sp2.y);
      this.ctx.lineWidth = 5;
      this.ctx.strokeStyle = '#fbbf24';
      this.ctx.stroke();
    }

    const distFt = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const midX = (sp1.x + sp2.x) / 2;
    const midY = (sp1.y + sp2.y) / 2;

    const labelText = formatFtIn(distFt);
    const boxWidth = Math.max(38, labelText.length * 7 + 8);

    this.ctx.fillStyle = isSelected ? '#b45309' : 'rgba(15, 23, 42, 0.85)';
    this.ctx.fillRect(midX - boxWidth / 2, midY - 8, boxWidth, 16);
    if (isSelected) {
      this.ctx.strokeStyle = '#fde68a';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(midX - boxWidth / 2, midY - 8, boxWidth, 16);
    }
    this.ctx.fillStyle = isSelected ? '#fef08a' : '#cbd5e1';
    this.ctx.font = isSelected ? 'bold 10px monospace' : '10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(labelText, midX, midY);
  }

  private distToSegment(p: Point, v: Point, w: Point): number {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }
}