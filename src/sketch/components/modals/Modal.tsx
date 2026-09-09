import { h, ComponentChildren } from 'preact';

interface ModalProps {
  title: string;
  width?: string;
  borderColor?: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function Modal({ title, width = '500px', borderColor, onClose, children }: ModalProps) {
  return (
    <div class="modal-backdrop" style={{ display: 'flex' }} onClick={onClose}>
      <div
        class="modal-content"
        style={{ width, borderColor: borderColor || 'var(--panel-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: borderColor || 'var(--accent)' }}>{title}</h3>
          <button class="btn btn-secondary btn-sm" onClick={onClose}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}