import { h } from 'preact';
import { useState } from 'preact/hooks';
import { store } from '../../state';
import { Modal } from './Modal';

interface DefaultsModalProps {
  onExportResume?: () => void;
}

export function DefaultsModal({ onExportResume }: DefaultsModalProps) {
  const [doorDeduct, setDoorDeduct] = useState(store.openingDefaults.doorDeductArea);
  const [windowDeduct, setWindowDeduct] = useState(store.openingDefaults.windowDeductArea);
  const [missingDeduct, setMissingDeduct] = useState(store.openingDefaults.missingWallDeductArea);

  const close = () => {
    store.activeModal = null;
    store.notify();
  };

  const handleSave = () => {
    store.openingDefaults.doorDeductArea = Math.max(0, doorDeduct);
    store.openingDefaults.windowDeductArea = Math.max(0, windowDeduct);
    store.openingDefaults.missingWallDeductArea = Math.max(0, missingDeduct);
    close();

    if (onExportResume) {
      onExportResume();
    }
  };

  return (
    <Modal title="⚙️ Global Opening Deduction Settings" width="480px" onClose={close}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Set the global <b>Deduct if &gt; (Sq Ft)</b> thresholds. These values apply across all openings upon export (converted to Xactimate units &times; 2,322,576).
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div class="field">
          <label>🚪 All Doors: Deduct if &gt; (Sq Ft)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={doorDeduct}
            onInput={(e) => setDoorDeduct(parseFloat((e.target as HTMLInputElement).value) || 0)}
          />
        </div>
        <div class="field">
          <label>🪟 All Windows: Deduct if &gt; (Sq Ft)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={windowDeduct}
            onInput={(e) => setWindowDeduct(parseFloat((e.target as HTMLInputElement).value) || 0)}
          />
        </div>
        <div class="field">
          <label>🧱 All Missing Walls / Openings: Deduct if &gt; (Sq Ft)</label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={missingDeduct}
            onInput={(e) => setMissingDeduct(parseFloat((e.target as HTMLInputElement).value) || 0)}
          />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
        <button class="btn" onClick={handleSave}>Apply Globally</button>
      </div>
    </Modal>
  );
}