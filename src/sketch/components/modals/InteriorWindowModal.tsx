import { h } from 'preact';
import { store } from '../../state';
import { formatFtIn } from '../../geometry';
import { getInteriorWindowViolations } from '../../validators/interiorWindowValidator';
import { Modal } from './Modal';

export function InteriorWindowModal({ onProceedExport, onRedraw }: { onProceedExport: () => void; onRedraw: () => void }) {
  const violations = getInteriorWindowViolations(store.shapes, store.levels, store.wallMetadataList);
  const close = () => { store.activeModal = null; store.notify(); };

  const handleConvert = (metaId: string, opId: string, type: string) => {
    store.changeOpeningType(metaId, opId, type);
    onRedraw();
    const remaining = getInteriorWindowViolations(store.shapes, store.levels, store.wallMetadataList);
    if (remaining.length === 0) {
      onProceedExport();
    } else {
      store.notify();
    }
  };

  return (
    <Modal title="🪟 Interior Window Confirmation" width="540px" borderColor="#38bdf8" onClose={close}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Windows detected on interior partition walls between rooms. Convert to doors or wall openings:
      </p>
      <div style={{ background: '#090d16', borderRadius: '6px', padding: '10px', maxHeight: '220px', overflowY: 'auto' }}>
        {violations.map((v) => (
          <div key={`${v.metaId}_${v.opId}`} style={{ borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '6px' }}>
            <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.8rem' }}>
              {v.levelName} &rsaquo; {v.rooms.map((r) => r.name).join(' ↔ ')}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Convert to:</span>
              <button class="btn btn-secondary btn-sm" onClick={() => handleConvert(v.metaId, v.opId, 'door')}>🚪 Door</button>
              <button class="btn btn-secondary btn-sm" onClick={() => handleConvert(v.metaId, v.opId, 'opening')}>🧱 Opening</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <button class="btn btn-secondary" onClick={close}>Review &amp; Edit</button>
        <button class="btn btn-amber" onClick={onProceedExport}>Confirm Windows &amp; Export</button>
      </div>
    </Modal>
  );
}