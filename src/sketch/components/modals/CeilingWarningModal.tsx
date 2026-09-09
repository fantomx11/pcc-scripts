import { h } from 'preact';
import { store } from '../../state';
import { formatFtIn } from '../../geometry';
import { getAllCeilingViolations } from '../../validators/ceilingValidator';
import { Modal } from './Modal';

interface CeilingWarningModalProps {
  onProceed: () => void;
}

export function CeilingWarningModal({ onProceed }: CeilingWarningModalProps) {
  const violations = getAllCeilingViolations(store.shapes, store.levels, store.wallMetadataList);

  const handleReviewAndFix = () => {
    store.activeModal = null;
    if (violations.length > 0) {
      const first = violations[0];
      store.switchLevel(first.room.levelId);
      store.selectShape(first.room.id);
    }
    store.notify();
  };

  return (
    <Modal title="⚠️ Ceiling Clearance Warning" width="520px" borderColor="#ef4444" onClose={handleReviewAndFix}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        One or more rooms have ceiling heights lower than their doors, windows, or wall openings. This can cause rendering or estimate errors in Xactimate.
      </p>
      <div
        style={{
          background: '#090d16',
          border: '1px solid #7f1d1d',
          borderRadius: '6px',
          padding: '10px',
          maxHeight: '180px',
          overflowY: 'auto',
          fontSize: '0.78rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {violations.map((v) => {
          const opListStr = v.violations
            .map((viol) => `${viol.label} (Top: ${formatFtIn(viol.topFt)})`)
            .join(', ');
          return (
            <div key={v.room.id} style={{ borderBottom: '1px solid #1e293b', paddingBottom: '4px' }}>
              <div style={{ color: '#f87171', fontWeight: 'bold' }}>
                {v.levelName} &rsaquo; {v.room.name} [{v.room.dimCode}]
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>
                Ceiling: <b style={{ color: '#fff' }}>{formatFtIn(v.ceilFt)}</b> &bull; Tallest: <b style={{ color: '#f87171' }}>{formatFtIn(v.maxTop)}</b> &bull; {opListStr}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
        <button class="btn btn-secondary" onClick={handleReviewAndFix}>Review &amp; Fix</button>
        <button class="btn btn-danger" onClick={onProceed}>Proceed with Export</button>
      </div>
    </Modal>
  );
}