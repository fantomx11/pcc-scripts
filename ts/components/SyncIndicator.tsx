import type { SyncStatus } from '../classes/Store';

interface SyncIndicatorProps {
  status?: SyncStatus;
}

export const SyncIndicator = ({ status }: SyncIndicatorProps) => {
  const config: Record<string, { class: string; text: string; color: string }> = {
    syncing: { class: 'spinner', text: 'SYNCING...', color: 'white' },
    error: { class: 'status-dot status-offline', text: 'SYNC ERROR', color: '#e74c3c' },
    saved: { class: 'status-dot status-online', text: 'CLOUD SAVED', color: '#95a5a6' },
  };

  const current = (status && config[status]) || config.saved;

  return (
    <div class="sync-indicator">
      <div class={current.class}></div>
      <span style={{ fontSize: '10px', color: current.color, marginLeft: '4px' }}>
        {current.text}
      </span>
    </div>
  );
};