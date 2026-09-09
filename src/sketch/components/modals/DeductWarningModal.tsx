import { h } from 'preact';
import { store } from '../../state';
import { Modal } from './Modal';

interface DeductWarningModalProps {
  onProceed: () => void;
}

export function DeductWarningModal({ onProceed }: DeductWarningModalProps) {
  const close = () => {
    store.activeModal = null;
    store.notify();
  };

  const handleOpenDefaults = () => {
    store.activeModal = 'defaults';
    store.notify();
  };

  return (
    <Modal title="⚠️ Deduction Thresholds Not Set" width="500px" borderColor="#fbbf24" onClose={close}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        None of the <b>"Deduct if &gt;"</b> opening thresholds have been set (all currently 0 SF). Without threshold limits, Xactimate will deduct 100% of all door, window, and wall opening surface areas.
      </p>
      <div
        style={{
          background: '#090d16',
          border: '1px solid var(--panel-border)',
          borderRadius: '6px',
          padding: '10px',
          fontSize: '0.76rem',
          color: '#cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div>• <b>Door Deduct:</b> 0 SF (Deduct 100%)</div>
        <div>• <b>Window Deduct:</b> 0 SF (Deduct 100%)</div>
        <div>• <b>Opening Deduct:</b> 0 SF (Deduct 100%)</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
        <button class="btn btn-amber" onClick={handleOpenDefaults}>⚙️ Set Deductions</button>
        <button class="btn btn-secondary" onClick={onProceed}>Proceed with Export</button>
      </div>
    </Modal>
  );
}