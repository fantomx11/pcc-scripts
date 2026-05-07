const {html} = await import("../modules/lib.js");

export const Sidebar = ({ jobs, activeEstimator }) => {
  const selectedDivisions = Array.from(document.getElementById('division-filter')?.selectedOptions || []).map(opt => opt.value);

  const sections = [
    { t: "Contact Needed", f: j => j.tasks.needsContact, c: "#e74c3c" },
    { t: "Warranty Jobs", f: j => j.division === "Warranty", c: "#3498db" },
    { t: "Needs Work Auth", f: j => j.tasks.needsWorkAuth, c: "#8e44ad" },
    { t: "Needs Signed CO", f: j => j.tasks.needsSignedCO, c: "#8e44ad" },
    { t: "Enter Deductible", f: j => j.tasks.needsDeductible, c: "#d35400" }
  ];

  const filtered = jobs.filter(e => {
    const estimatorMatch = (activeEstimator === "All" ? true : e.estimator === activeEstimator);
    const divisionMatch = selectedDivisions.length === 0 || selectedDivisions.includes(e.division);
    return estimatorMatch && divisionMatch;
  });

  return html`
    <div class="sidebar">
      ${sections.map(sec => {
        const list = filtered.filter(sec.f);
        if (!list.length) return null;
        return html`
          <div>
            <h4>${sec.t} (${list.length})</h4>
            ${list.map(j => html`
              <div class="sidebar-item" style="border-left: 3px solid ${sec.c}" 
                    onClick=${() => window.App.openModal(j.uniqueId)}>
                <b>${j.jobNumber}</b><br/>${j.customer} - ${j.description}
              </div>
            `)}
          </div>
        `;
      })}
    </div>
  `;
};