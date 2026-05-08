const {html} = await import("../modules/lib.js");
const { KanbanPhases } = await import("../modules/enums.js");
const { JobCard } = await import("./JobCard.js");

export const KanbanBoard = ({ estimates, activeEstimator }) => {
    const selectedDivisions = Array.from(document.getElementById('division-filter')?.selectedOptions || []).map(opt => opt.value);

    const filtered = estimates.filter(e => {
      const estimatorMatch = (activeEstimator === "All" ? true : e.estimator === activeEstimator);
      const divisionMatch = selectedDivisions.length === 0 || selectedDivisions.includes(e.division);
      return estimatorMatch && divisionMatch;
    });

    return html`
      <div class="main-content" id="board">
        ${Object.keys(KanbanPhases).map(phaseKey => {
      let phase = KanbanPhases[phaseKey];

      if (phase.kanbanDisplay) {
        return html`
                  <div class="phase-col ${phase.kanbanGroup}">
                    <h3>${phase.column.toUpperCase()}</h3>
                    <div class="card-list">
                      ${filtered.filter(e => e.phase === phase && e.division !== "Warranty")
            .sort((a, b) => b.aging - a.aging)
            .map(est => html`<${JobCard} est=${est} onOpen=${() => window.App.openModal(est.uniqueId)} />`)}
                    </div>
                  </div>
                `
      } else {
        return '';
      }
    })}
      </div>
    `;
  };
