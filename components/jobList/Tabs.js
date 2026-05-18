import { html } from '../../modules/lib.js';

export function Tabs({ groups, activeTab, setActiveTab }) {
  return html`
    <div class="tabs">
      ${groups.map(({ name, count }) => {
          const isActive = activeTab === name;
          return html`
            <button
              key=${name}
              class="dashboard-tab-button ${isActive ? 'active' : ''}"
              onClick=${() => setActiveTab(name)}>
                ${name} (${count})
              </button>
          `;
      })}
      </div>
  `;
}
