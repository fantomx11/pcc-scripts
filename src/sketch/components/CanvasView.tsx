import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { store } from '../state';
import { SketchViewer } from '../viewer';
import { snapToInch } from '../geometry';
import { processImportText } from './modals/ImportModal';

interface CanvasViewProps {
  viewerRef: { current: SketchViewer | null };
}

export function CanvasView({ viewerRef }: CanvasViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const viewer = new SketchViewer(canvasRef.current, {
      getShapes: () => store.shapes,
      getLevels: () => store.levels,
      getCurrentLevelId: () => store.currentLevelId,
      getWallMetadata: () => store.wallMetadataList,
      getSelectedShapeId: () => store.selectedShapeId,
      getSelectedEdge: () => store.selectedEdge,
      shouldShowUnderlay: () => store.showUnderlay,
    });

    viewerRef.current = viewer;
    viewer.resize();

    const onResize = () => viewer.resize();
    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleAdd = (type: 'room' | 'line' | 'area' | 'block') => {
    if (!viewerRef.current) return;
    const centerWorld = viewerRef.current.screenToWorld(
      viewerRef.current.canvas.width / 2,
      viewerRef.current.canvas.height / 2
    );
    store.addShape(type, centerWorld);
    viewerRef.current.draw();
  };

  const handleFileDrop = (e: DragEvent) => {
    e.preventDefault();
    containerRef.current?.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (typeof evt.target?.result === 'string') {
          processImportText(evt.target.result, { scaleUnits: true, filterVoids: true, targetMode: 'current_level' });
          viewerRef.current?.resetView();
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div
      id="canvas-container"
      ref={containerRef}
      onDragOver={(e) => { e.preventDefault(); containerRef.current?.classList.add('drag-over'); }}
      onDragLeave={() => containerRef.current?.classList.remove('drag-over')}
      onDrop={handleFileDrop}
    >
      <div class="drop-overlay">
        <span>📥 Drop JSON or SVG File Here</span>
        <small>Imports rooms, stub walls, wall offsets, ceiling heights, doors, windows &amp; wall openings</small>
      </div>

      <div class="canvas-toolbar">
        <button class="btn btn-secondary btn-sm" onClick={() => handleAdd('room')}>+ Room</button>
        <button class="btn btn-secondary btn-sm" onClick={() => handleAdd('line')}>+ Ref Line</button>
        <button class="btn btn-secondary btn-sm" onClick={() => handleAdd('area')}>+ Area</button>
        <button class="btn btn-secondary btn-sm" onClick={() => handleAdd('block')}>+ Ref Block</button>
        <div class="toolbar-divider"></div>
        <button
          class={`btn btn-secondary btn-sm ${store.splitState.isSplitMode ? 'btn-active-tool' : ''}`}
          onClick={() => {
            store.splitState.isSplitMode ? store.exitSplitMode() : (store.splitState.isSplitMode = true);
            store.notify();
            viewerRef.current?.draw();
          }}
        >
          ✂️ Split Room
        </button>
        <div class="toolbar-divider"></div>
        <button
          class="btn btn-secondary btn-sm"
          title="Rotate active floor 180°"
          onClick={() => { viewerRef.current?.rotateCurrentLevel180(); store.notify(); }}
        >
          🔄 Rotate 180°
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', margin: '0 4px' }}>
          <input
            type="checkbox"
            checked={store.showUnderlay}
            onChange={(e) => { store.showUnderlay = (e.target as HTMLInputElement).checked; viewerRef.current?.draw(); store.notify(); }}
          /> 👁 Underlay
        </label>
        <div class="toolbar-divider"></div>
        <button class="btn btn-secondary btn-sm" onClick={() => { viewerRef.current?.adjustZoom(1.2); store.notify(); }}>+</button>
        <span class="zoom-indicator">{Math.round((viewerRef.current?.zoom || 1.0) * 100)}%</span>
        <button class="btn btn-secondary btn-sm" onClick={() => { viewerRef.current?.adjustZoom(0.8); store.notify(); }}>-</button>
        <button class="btn btn-secondary btn-sm" onClick={() => { viewerRef.current?.resetView(); store.notify(); }}>Center</button>
      </div>

      <div class="instructions-pill">
        • <b>Scroll / Swipe</b> to pan • <b>Ctrl+Scroll</b> to zoom • <b>Space / Right-click drag</b> to pan • <b>Click wall</b> to inspect
      </div>

      <canvas ref={canvasRef} id="canvas"></canvas>
    </div>
  );
}