import { h } from 'preact';
import { useState } from 'preact/hooks';
import { store } from '../../state';
import { sanitizeDimCode } from '../../geometry';
import type { Shape } from '../../types';
import { Modal } from './Modal';

export function SplitConfirmModal({ onRedraw }: { onRedraw: () => void }) {
  const pending = store.splitState.pendingData;
  const [name1, setName1] = useState(pending ? `${pending.originalRoom.name} A` : '');
  const [name2, setName2] = useState(pending ? `${pending.originalRoom.name} B` : '');

  const close = () => {
    store.exitSplitMode();
  };

  const handleConfirm = () => {
    if (!pending) return;
    const { originalRoom, poly1, poly2 } = pending;

    const finalName1 = name1.trim() || `${originalRoom.name} A`;
    const finalName2 = name2.trim() || `${originalRoom.name} B`;

    const room1: Shape = {
      id: originalRoom.id,
      levelId: originalRoom.levelId,
      type: 'room',
      name: finalName1,
      dimCode: sanitizeDimCode(finalName1),
      isDimCodeManual: false,
      ceilingHeightFt: originalRoom.ceilingHeightFt || 8.0,
      points: poly1,
      stubWalls: originalRoom.stubWalls || [],
    };

    const room2: Shape = {
      id: store.getNextId(),
      levelId: originalRoom.levelId,
      type: 'room',
      name: finalName2,
      dimCode: sanitizeDimCode(finalName2),
      isDimCodeManual: false,
      ceilingHeightFt: originalRoom.ceilingHeightFt || 8.0,
      points: poly2,
      stubWalls: [],
    };

    const idx = store.shapes.findIndex((s) => s.id === originalRoom.id);
    if (idx !== -1) {
      store.shapes.splice(idx, 1, room1, room2);
    }

    store.exitSplitMode();
    store.selectShape(room1.id);
    onRedraw();
  };

  return (
    <Modal title="✂️ Confirm Room Split" width="460px" borderColor="#fbbf24" onClose={close}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
        Split "{pending?.originalRoom.name}" into two separate rooms along the dividing line?
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div class="field">
          <label>Room 1 Name</label>
          <input type="text" value={name1} onInput={(e) => setName1((e.target as HTMLInputElement).value)} />
        </div>
        <div class="field">
          <label>Room 2 Name</label>
          <input type="text" value={name2} onInput={(e) => setName2((e.target as HTMLInputElement).value)} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
        <button class="btn btn-secondary" onClick={close}>Cancel</button>
        <button class="btn btn-amber" onClick={handleConfirm}>Confirm Split</button>
      </div>
    </Modal>
  );
}