const {html} = await import("../modules/lib.js");

export const KanbanBoard = ({ estimates, activeEstimator }) => {
    const selectedDivisions = Array.from(document.getElementById('division-filter')?.selectedOptions || []).map(opt => opt.value);

    const filtered = estimates.filter(e => {
      const estimatorMatch = (activeEstimator === "All" ? true : e.estimator === activeEstimator);
      const divisionMatch = selectedDivisions.length === 0 || selectedDivisions.includes(e.division);
      return estimatorMatch && divisionMatch;
    });

    return html`
      <div class="main-content" id="board">
        ${Object.keys(Phases).map(phaseKey => {
      let phase = Phases[phaseKey];

      if (PhaseData[phaseKey]?.showBoard) {
        return html`
                  <div class="phase-col ${PhaseData[phaseKey]?.group}">
                    <h3>${phase.toUpperCase()}</h3>
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
