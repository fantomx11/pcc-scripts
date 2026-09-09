import { h } from 'preact';
import { store } from '../state';

export function Header() {
  return (
    <header>
      <h1><span>📐</span> Xactimate Multi-Floor Sketch Generator</h1>
      <div class="level-tabs">
        {store.levels.map((lvl) => (
          <button
            key={lvl.id}
            class={`level-tab ${lvl.id === store.currentLevelId ? 'active' : ''}`}
            onClick={() => store.switchLevel(lvl.id)}
          >
            {lvl.name}
          </button>
        ))}
        <button
          class="level-tab-add"
          title="Add New Floor"
          onClick={() => store.addLevel()}
        >
          + Floor
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button class="btn btn-secondary" onClick={() => (store.activeModal = 'defaults', store.notify())}>
          ⚙️ Deduct Settings
        </button>
        <button class="btn btn-secondary" onClick={() => (store.activeModal = 'import', store.notify())}>
          📥 Import (JSON / SVG)
        </button>
        <button class="btn" onClick={() => (store.activeModal = 'export', store.notify())}>
          Export Template (.SKX)
        </button>
      </div>
    </header>
  );
}