import type { FunctionalComponent } from 'preact';
import type { TabGroup } from './types';

interface TabsProps {
  groups: TabGroup[];
  activeTab: string | null;
  setActiveTab: (name: string) => void;
}

export const Tabs: FunctionalComponent<TabsProps> = ({
  groups,
  activeTab,
  setActiveTab,
}) => {
  return (
    <div class="tabs">
      {groups.map(({ name, count }) => {
        const isActive = activeTab === name;
        return (
          <button
            key={name}
            type="button"
            class={`dashboard-tab-button ${isActive ? 'active' : ''}`.trim()}
            onClick={() => setActiveTab(name)}
          >
            {name} ({count})
          </button>
        );
      })}
    </div>
  );
};