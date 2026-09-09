import { useState } from 'preact/hooks';
import type { Estimate } from '../classes/Estimate';
import { KanbanPhases, type KanbanPhaseDefinition } from '../modules/enums';
import { JobCard } from './JobCard';

interface KanbanBoardProps {
  estimates: Estimate[];
  activeEstimator: string;
  selectedDivs?: string[];
}

interface GroupState {
  label: string;
  phases: KanbanPhaseDefinition[];
  count: number;
  shouldFlash: boolean;
}

export const KanbanBoard = ({
  estimates,
  activeEstimator,
  selectedDivs,
}: KanbanBoardProps) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'group-intake': true,
    'group-pre-con': false,
    'group-pm': true,
    'group-collections': true,
  });

  const activeDivisions = selectedDivs || Array.from(
    (document.getElementById('division-filter') as HTMLSelectElement)?.selectedOptions || []
  ).map(opt => opt.value);

  const filtered = estimates.filter(e => {
    const estimatorMatch = (
      activeEstimator === 'All'
        ? true
        : e.estimator === activeEstimator ||
          e.supervisor === activeEstimator ||
          e.phase === KanbanPhases.AssignEstimator
    );
    const divisionMatch = activeDivisions.length === 0 || activeDivisions.includes(e.division || '');
    return estimatorMatch && divisionMatch;
  });

  const groups: Record<string, GroupState> = {
    'group-intake': { label: 'Intake', phases: [], count: 0, shouldFlash: false },
    'group-pre-con': { label: 'Pre-Production', phases: [], count: 0, shouldFlash: false },
    'group-pm': { label: 'Production', phases: [], count: 0, shouldFlash: false },
    'group-collections': { label: 'Collections', phases: [], count: 0, shouldFlash: false },
  };

  Object.keys(KanbanPhases).forEach(phaseKey => {
    const phase = (KanbanPhases as Record<string, any>)[phaseKey] as KanbanPhaseDefinition;
    if (phase?.kanbanDisplay && phase.kanbanGroup && groups[phase.kanbanGroup]) {
      const count = filtered.filter(e => e.phase === phase && e.division !== 'Warranty').length;
      const shouldFlash = phase.flashIfOccupied && count > 0;

      groups[phase.kanbanGroup].phases.push(phase);
      groups[phase.kanbanGroup].count += count;
      groups[phase.kanbanGroup].shouldFlash = groups[phase.kanbanGroup].shouldFlash || shouldFlash;
    }
  });

  const focusGroup = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const nextState: Record<string, boolean> = {};
      Object.keys(prev).forEach(key => {
        nextState[key] = key !== groupKey;
      });
      return nextState;
    });
  };

  return (
    <div class="main-content" id="board">
      {Object.keys(groups).map(groupKey => {
        const group = groups[groupKey];
        const isCollapsed = collapsedGroups[groupKey];
        const shouldFlash = group.shouldFlash;

        if (isCollapsed) {
          return (
            <div
              key={groupKey}
              class={`kanban-group-collapsed ${groupKey} ${shouldFlash ? 'has-items-flash' : ''}`}
              onClick={() => focusGroup(groupKey)}
              title="Click to Expand"
            >
              <div class="collapsed-title">
                {group.label.toUpperCase()} ({group.count})
              </div>
            </div>
          );
        }

        return (
          <div key={groupKey} class={`kanban-group-wrapper ${groupKey}`}>
            <div class={`group-header ${groupKey}`}>
              <span>{group.label} ({group.count})</span>
            </div>
            <div class="group-columns-container">
              {group.phases.map(phase => (
                <div key={phase.column} class={`phase-col ${phase.kanbanGroup || ''}`}>
                  <h3>{phase.column.toUpperCase()}</h3>
                  <div class="card-list">
                    {filtered
                      .filter(e => e.phase === phase && e.division !== 'Warranty')
                      .sort((a, b) => b.aging - a.aging)
                      .map(est => (
                        <JobCard
                          key={est.uniqueId}
                          est={est}
                          onOpen={() => (window as any).App?.openModal(est.uniqueId)}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};