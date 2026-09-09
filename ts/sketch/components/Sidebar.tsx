import { h } from 'preact';
import { useState } from 'preact/hooks';
import { store } from '../state';
import { formatFtIn, sanitizeDimCode, snapToInch, parseFeetInches } from '../geometry';
import { getRoomCeilingViolations } from '../validators/ceilingValidator';

export function Sidebar({ onRedraw }: { onRedraw: () => void }) {
  const activeShapes = store.getActiveShapes();
  const currentLvl = store.levels.find((l) => l.id === store.currentLevelId);
  const selectedShape = store.shapes.find((s) => s.id === store.selectedShapeId);
  const [calibInput, setCalibInput] = useState('');

  const ceilReport = selectedShape?.type === 'room'
    ? getRoomCeilingViolations(selectedShape, store.wallMetadataList)
    : { violations: [], maxTop: 0, ceilFt: 8.0 };

  const recCeil = Math.ceil((ceilReport.maxTop + 0.05) * 4) / 4;

  // Find wall openings if an edge is selected
  let selectedEdgeMeta = null;
  let edgeLengthFt = 0;
  if (selectedShape && store.selectedEdge && store.selectedEdge.shapeId === selectedShape.id) {
    const p1 = selectedShape.points[store.selectedEdge.edgeIndex];
    const p2 = selectedShape.points[(store.selectedEdge.edgeIndex + 1) % selectedShape.points.length];
    edgeLengthFt = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    selectedEdgeMeta = store.wallMetadataList.find((m) => {
      const d1 = Math.hypot(m.p0.x - p1.x, m.p0.y - p1.y) + Math.hypot(m.p1.x - p2.x, m.p1.y - p2.y);
      const d2 = Math.hypot(m.p0.x - p2.x, m.p0.y - p2.y) + Math.hypot(m.p1.x - p1.x, m.p1.y - p1.y);
      return Math.min(d1, d2) < 0.35;
    });
  }

  const handleScaleWall = () => {
    const parsedFt = parseFeetInches(calibInput);
    if (!parsedFt || edgeLengthFt <= 0 || !selectedShape || !store.selectedEdge) {
      alert('Please enter a valid length (e.g. 14\' 6" or 14.5).');
      return;
    }
    const targetLen = snapToInch(parsedFt);
    const scaleFactor = targetLen / edgeLengthFt;
    const p1 = selectedShape.points[store.selectedEdge.edgeIndex];
    const anchorX = p1.x;
    const anchorY = p1.y;

    store.shapes.forEach((s) => {
      s.points = s.points.map((p) => ({
        x: snapToInch(anchorX + (p.x - anchorX) * scaleFactor),
        y: snapToInch(anchorY + (p.y - anchorY) * scaleFactor),
      }));
      (s.stubWalls || []).forEach((sw) => {
        sw.p0 = { x: snapToInch(anchorX + (sw.p0.x - anchorX) * scaleFactor), y: snapToInch(anchorY + (sw.p0.y - anchorY) * scaleFactor) };
        sw.p1 = { x: snapToInch(anchorX + (sw.p1.x - anchorX) * scaleFactor), y: snapToInch(anchorY + (sw.p1.y - anchorY) * scaleFactor) };
      });
    });
    store.wallMetadataList.forEach((m) => {
      m.p0 = { x: snapToInch(anchorX + (m.p0.x - anchorX) * scaleFactor), y: snapToInch(anchorY + (m.p0.y - anchorY) * scaleFactor) };
      m.p1 = { x: snapToInch(anchorX + (m.p1.x - anchorX) * scaleFactor), y: snapToInch(anchorY + (m.p1.y - anchorY) * scaleFactor) };
    });
    store.notify();
    onRedraw();
  };

  return (
    <div class="sidebar">
      {/* Floor Settings */}
      <div class="sidebar-section" style={{ background: '#192231' }}>
        <h3>
          <span>Floor Settings</span>
          <button class="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: '0.65rem' }} onClick={() => store.deleteCurrentLevel()}>
            Delete Floor
          </button>
        </h3>
        <div class="field" style={{ marginBottom: '6px' }}>
          <label>Floor Name</label>
          <input
            type="text"
            value={currentLvl?.name || ''}
            onInput={(e) => {
              if (currentLvl) { currentLvl.name = (e.target as HTMLInputElement).value; store.notify(); }
            }}
          />
        </div>
      </div>

      {/* Element Properties */}
      <div class="sidebar-section" id="inspector-panel">
        <h3>Element Properties</h3>

        <div class="legend-box">
          <div class="legend-item"><div class="legend-color" style={{ background: '#f97316' }}></div> Door</div>
          <div class="legend-item"><div class="legend-color" style={{ background: '#38bdf8' }}></div> Window</div>
          <div class="legend-item"><div class="legend-color" style={{ background: '#a855f7' }}></div> Wall Opening</div>
          <div class="legend-item"><div class="legend-color" style={{ background: '#94a3b8', border: '1px dashed #fff' }}></div> Missing Wall</div>
        </div>

        {!selectedShape ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Select a shape or wall to edit details.</div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span class={`badge badge-${selectedShape.type}`}>{selectedShape.type}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{selectedShape.type.toUpperCase()}</span>
            </div>

            <div class="field">
              <label>Name / Label</label>
              <input
                type="text"
                value={selectedShape.name}
                onInput={(e) => {
                  selectedShape.name = (e.target as HTMLInputElement).value;
                  if (!selectedShape.isDimCodeManual) selectedShape.dimCode = sanitizeDimCode(selectedShape.name);
                  store.notify();
                  onRedraw();
                }}
              />
            </div>

            <div class="field">
              <label>dimCode</label>
              <input
                type="text"
                class="dimcode"
                value={selectedShape.dimCode}
                onInput={(e) => {
                  selectedShape.isDimCodeManual = true;
                  selectedShape.dimCode = sanitizeDimCode((e.target as HTMLInputElement).value);
                  store.notify();
                  onRedraw();
                }}
              />
            </div>

            {selectedShape.type === 'room' && (
              <div class="field">
                <label>Ceiling Height (ft)</label>
                <input
                  type="number"
                  step="0.25"
                  value={selectedShape.ceilingHeightFt || 8.0}
                  onInput={(e) => {
                    selectedShape.ceilingHeightFt = parseFloat((e.target as HTMLInputElement).value) || 8.0;
                    store.notify();
                    onRedraw();
                  }}
                />
              </div>
            )}

            {/* Quality Gate 1: Live Warning Box */}
            {ceilReport.violations.length > 0 && (
              <div class="calibration-box" style={{ borderColor: '#ef4444', background: 'rgba(239, 68, 68, 0.12)', marginTop: '6px' }}>
                <div style={{ color: '#f87171', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚠️ Ceiling Lower Than Openings
                </div>
                <div style={{ fontSize: '0.72rem', color: '#fca5a5' }}>
                  Tallest opening reaches <b>{formatFtIn(ceilReport.maxTop)}</b> (Ceiling is {formatFtIn(ceilReport.ceilFt)}).
                </div>
                <button
                  class="btn btn-sm btn-danger"
                  style={{ marginTop: '4px', fontSize: '0.72rem' }}
                  onClick={() => { selectedShape.ceilingHeightFt = recCeil; store.notify(); onRedraw(); }}
                >
                  Adjust Ceiling to {formatFtIn(recCeil)}
                </button>
              </div>
            )}

            {/* Openings on Selected Wall */}
            {selectedEdgeMeta && selectedEdgeMeta.openings.length > 0 && (
              <div class="calibration-box" style={{ borderColor: '#38bdf8', marginTop: '10px' }}>
                <div class="calibration-title" style={{ color: '#38bdf8' }}>🚪 Wall Openings &amp; Status</div>
                {selectedEdgeMeta.openings.map((op) => {
                  const areaSqFt = parseFloat(((op.widthFt || 3.0) * (op.heightFt || 3.0)).toFixed(1));
                  const threshold = op.isDoor ? store.openingDefaults.doorDeductArea : op.isWindow ? store.openingDefaults.windowDeductArea : store.openingDefaults.missingWallDeductArea;
                  const isDeducted = threshold === 0 || areaSqFt > threshold;
                  const currentType = op.isDoor ? 'door' : op.isWindow ? 'window' : 'opening';

                  return (
                    <div key={op.id} class="opening-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <select
                          style={{ flex: 1, padding: '3px 6px', fontSize: '0.75rem' }}
                          value={currentType}
                          onChange={(e) => { store.changeOpeningType(selectedEdgeMeta!.id, op.id, (e.target as HTMLSelectElement).value); onRedraw(); }}
                        >
                          <option value="door">🚪 Door</option>
                          <option value="window">🪟 Window</option>
                          <option value="opening">🧱 Wall Opening</option>
                        </select>
                        <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: '0.72rem' }}>
                          {formatFtIn(op.widthFt)} × {formatFtIn(op.heightFt)}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.68rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                        <span>Area: <b style={{ color: '#cbd5e1' }}>{areaSqFt} SF</b></span>
                        <span style={{ fontWeight: 'bold', color: isDeducted ? '#4ade80' : '#f59e0b' }}>
                          {isDeducted ? '✓ Deducted' : '✗ Not Deducted'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Scale Sketch by Wall */}
            {store.selectedEdge && (
              <div class="calibration-box">
                <div class="calibration-title"><span>📏</span> Scale Sketch by Wall</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Current Wall: <b style={{ color: '#fbbf24', fontFamily: 'monospace' }}>{formatFtIn(edgeLengthFt)}</b>
                </div>
                <div class="field" style={{ marginBottom: '4px' }}>
                  <label style={{ color: '#fbbf24' }}>Target Length (e.g. 14' 6" or 14.5)</label>
                  <input
                    type="text"
                    placeholder="e.g. 14' 6&quot;, 14.5, 174&quot;"
                    value={calibInput}
                    onInput={(e) => setCalibInput((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleScaleWall()}
                  />
                </div>
                <button class="btn btn-amber btn-sm" onClick={handleScaleWall}>Apply Scale</button>
              </div>
            )}

            <button class="btn btn-danger btn-sm" style={{ width: '100%', marginTop: '12px' }} onClick={() => { store.deleteSelectedShape(); onRedraw(); }}>
              Delete Shape
            </button>
          </div>
        )}
      </div>

      {/* Floor Elements List */}
      <div class="sidebar-section" style={{ flex: 1 }}>
        <h3>Floor Elements ({activeShapes.length})</h3>
        {activeShapes.map((shape) => {
          const isRoom = shape.type === 'room';
          const report = isRoom ? getRoomCeilingViolations(shape, store.wallMetadataList) : { violations: [] };
          return (
            <div
              key={shape.id}
              class={`item-card ${shape.id === store.selectedShapeId ? 'active' : ''}`}
              style={report.violations.length > 0 ? { borderColor: '#ef4444' } : {}}
              onClick={() => { store.selectShape(shape.id); onRedraw(); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span class={`badge badge-${shape.type}`}>{shape.type}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{shape.name}</span>
                {report.violations.length > 0 && (
                  <span class="badge" style={{ background: '#ef4444', color: '#fff', fontSize: '0.6rem' }}>⚠️ Ceil Low</span>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent)' }}>{shape.dimCode}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}