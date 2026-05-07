const {html} = await import('../modules/lib.js');

export const SyncIndicator = ({ status }) => {
    const config = {
      syncing: { class: 'spinner', text: 'SYNCING...', color: 'white' },
      error: { class: 'status-dot status-offline', text: 'SYNC ERROR', color: '#e74c3c' },
      saved: { class: 'status-dot status-online', text: 'CLOUD SAVED', color: '#95a5a6' }
    };
    const current = config[status] || config.saved;

    return html`
      <div class="sync-indicator">
        <div class="${current.class}"></div>
        <span style="font-size:10px; color:${current.color}; margin-left: 4px">${current.text}</span>
      </div>
    `;
  };
