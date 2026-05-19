const { useState } = await import('https://esm.sh/preact/hooks');
const { html } = await import("../modules/lib.js");
const { KanbanPhases } = await import("../modules/enums.js");
const { JobCard } = await import("./JobCard.js");

export const KanbanBoard = ({ estimates, activeEstimator }) => {
    // Local state tracking which column groups are collapsed
    const [collapsedGroups, setCollapsedGroups] = useState({
      "group-pre-con": false,
      "group-pm": true,
      "group-collections": true
    });

    const selectedDivisions = Array.from(document.getElementById('division-filter')?.selectedOptions || []).map(opt => opt.value);

    const filtered = estimates.filter(e => {
      const estimatorMatch = (activeEstimator === "All" ? true : e.estimator === activeEstimator || e.supervisor === activeEstimator);
      const divisionMatch = selectedDivisions.length === 0 || selectedDivisions.includes(e.division);
      return estimatorMatch && divisionMatch;
    });

    // Define structural columns groups in sequential display order
    const groups = {
      "group-pre-con": { label: "Pre-Production", phases: [], count: 0 },
      "group-pm": { label: "Production", phases: [], count: 0 },
      "group-collections": { label: "Collections", phases: [], count: 0 }
    };

    // Sort phases into their respective display categories
    Object.keys(KanbanPhases).forEach(phaseKey => {
      const phase = KanbanPhases[phaseKey];
      if (phase.kanbanDisplay && groups[phase.kanbanGroup]) {
        groups[phase.kanbanGroup].phases.push(phase);
        groups[phase.kanbanGroup].count += filtered.filter(e => e.phase === phase && e.division !== "Warranty").length;
      }
    });

    

    const toggleGroup = (groupKey) => {
      setCollapsedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    const focusGroup = (groupKey) => {
      setCollapsedGroups(prev => {
        const nextState = {};
        Object.keys(prev).forEach(key => {
          nextState[key] = (key !== groupKey);
        });
        return nextState;
      });
    }

    const collapseGroups = () => {
      setCollapsedGroups(prev => {
        const nextState = {};
        Object.keys(prev).forEach(key => {
          nextState[key] = true;
        });
        return nextState;
      });
    }

    return html`
      <div class="main-content" id="board">
        ${Object.keys(groups).map(groupKey => {
          const group = groups[groupKey];
          const isCollapsed = collapsedGroups[groupKey];
          
          // Render thin placeholder ribbon if group is collapsed
          if (isCollapsed) {
            return html`
              <div class=${`kanban-group-collapsed ${groupKey}`} onClick=${() => focusGroup(groupKey)} title="Click to Expand">
                <div class="collapsed-title">${group.label.toUpperCase()} (${group.count})</div>
              </div>
            `;
          }

          // Render active expanded grouping frame
          return html`
            <div class=${`kanban-group-wrapper ${groupKey}`}>
              <div class=${`group-header ${groupKey}`}>
                <span>${group.label} (${group.count})</span>
                <!--
                <div>
                  ◀ Collapse
                  <span class="collapse-group-btn" role="button" onClick=${() => toggleGroup(groupKey)}>This</span>
                  <span class="collapse-group-btn" role="button" onClick=${() => focusGroup(groupKey)}>Others</span>
                  <span class="collapse-group-btn" role="button" onClick=${() => collapseGroups()}>All</span>
                </div>
                -->
              </div>
              <div class="group-columns-container">
                ${group.phases.map(phase => html`
                  <div class=${`phase-col ${phase.kanbanGroup}`}>
                    <h3>${phase.column.toUpperCase()}</h3>
                    <div class="card-list">
                      ${filtered.filter(e => e.phase === phase && e.division !== "Warranty")
                        .sort((a, b) => b.aging - a.aging)
                        .map(est => html`<${JobCard} est=${est} onOpen=${() => window.App.openModal(est.uniqueId)} />`)}
                    </div>
                  </div>
                `)}
              </div>
            </div>
          `;
        })}
      </div>
    `;
};
