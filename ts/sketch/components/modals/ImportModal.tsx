import { h } from 'preact';
import { useState } from 'preact/hooks';
import { store } from '../../state';
import { importJsonModel } from '../../importers/jsonImporter';
import { importSvgString } from '../../importers/svgImporter';
import { Modal } from './Modal';

export function ImportModal({ onRedraw }: { onRedraw: () => void }) {
  const [importText, setImportText] = useState('');
  const [targetMode, setTargetMode] = useState<'new_level' | 'current_level' | 'append_current'>('current_level');
  const [newLevelName, setNewLevelName] = useState(`Level ${store.levels.length + 1}`);
  const [scaleMeters, setScaleMeters] = useState(true);
  const [filterVoids, setFilterVoids] = useState(true);

  const close = () => {
    store.activeModal = null;
    store.notify();
  };

  const handleFileUpload = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (typeof evt.target?.result === 'string') {
        setImportText(evt.target.result);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    const trimmed = importText.trim();
    if (!trimmed) {
      alert('Please paste content or choose a file.');
      return;
    }

    try {
      const isJson = trimmed.startsWith('{') || trimmed.startsWith('[');
      const opts = {
        scaleUnits: scaleMeters,
        filterVoids,
        targetMode,
        newLevelName,
        currentLevelId: store.currentLevelId,
        levels: store.levels,
        shapes: store.shapes,
        wallMetadataList: store.wallMetadataList,
        getNextId: store.getNextId,
        getNextLevelId: store.getNextLevelId,
      };

      const res = isJson ? importJsonModel(JSON.parse(trimmed), opts) : importSvgString(trimmed, opts);

      store.shapes = res.shapes;
      store.levels = res.levels;
      store.currentLevelId = res.currentLevelId;
      store.wallMetadataList = res.wallMetadata;
      if (res.modelName) store.filename = res.modelName;
      if (res.shapes.length > 0) store.selectShape(res.shapes[0].id);

      close();
      onRedraw();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  return (
    <Modal title="Import Plan (JSON or SVG)" width="860px" onClose={close}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Paste or upload JSON / SVG floorplans. Graph walls, partition dividers, ceiling heights, doors, windows, and wall openings are imported directly.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          background: '#090d16',
          padding: '10px',
          borderRadius: '6px',
          border: '1px solid var(--panel-border)',
        }}
      >
        <div class="field" style={{ marginBottom: 0 }}>
          <label>Import Mode (for single-floor files)</label>
          <select value={targetMode} onChange={(e) => setTargetMode((e.target as HTMLSelectElement).value as any)}>
            <option value="new_level">➕ Create as New Floor</option>
            <option value="current_level">📍 Overwrite Current Floor</option>
            <option value="append_current">📎 Append to Current Floor</option>
          </select>
        </div>
        <div class="field" style={{ marginBottom: 0 }}>
          <label>New Floor Name</label>
          <input
            type="text"
            value={newLevelName}
            onInput={(e) => setNewLevelName((e.target as HTMLInputElement).value)}
            placeholder="e.g. Level 2 / Second Floor"
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="file" accept=".json,.svg,application/json,image/svg+xml" onChange={handleFileUpload} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={scaleMeters} onChange={(e) => setScaleMeters((e.target as HTMLInputElement).checked)} />
          Convert Meters to Feet (&times;3.28084)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={filterVoids} onChange={(e) => setFilterVoids((e.target as HTMLInputElement).checked)} />
          Exclude Inaccessible / Void Areas
        </label>
      </div>
      <textarea
        placeholder="Paste JSON floorplan object or SVG markup here..."
        value={importText}
        onInput={(e) => setImportText((e.target as HTMLTextAreaElement).value)}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button class="btn btn-secondary" onClick={close}>Cancel</button>
        <button class="btn" onClick={handleExecuteImport}>Import Floor Data</button>
      </div>
    </Modal>
  );
}