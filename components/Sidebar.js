// components/Sidebar.js
const { html } = await import("../modules/lib.js");

export const Sidebar = ({ jobs, activeEstimator, complianceTasks = [] }) => {
  const selectedDivisions = Array.from(document.getElementById('division-filter')?.selectedOptions || []).map(opt => opt.value);

  if(complianceTasks === null) complianceTasks = [];
  
  // 1. Core local task sections and their theme color definitions
  const sections = [
    { t: "Contact Needed", f: j => j.tasks.needsContact, c: "#e74c3c" },
    { t: "Warranty Jobs", f: j => j.division === "Warranty", c: "#3498db" },
    { t: "Needs Work Auth", f: j => j.tasks.needsWorkAuth, c: "#8e44ad" },
    { t: "Needs Signed CO", f: j => j.tasks.needsSignedCO, c: "#8e44ad" },
    { t: "Enter Deductible", f: j => j.tasks.needsDeductible, c: "#d35400" }
  ];

  // Filter core estimates based on active tab view filters
  const filteredJobs = jobs.filter(e => {
    const estimatorMatch = (activeEstimator === "All" ? true : e.estimator === activeEstimator);
    const divisionMatch = selectedDivisions.length === 0 || selectedDivisions.includes(e.division);
    return estimatorMatch && divisionMatch;
  });

  // 2. COMPLIANCE PROCESSING: Filter compliance records against the current active estimator tab
  const targetEstimatorTasks = complianceTasks.filter(task => {
    return activeEstimator === "All" || task.estimatorName === activeEstimator;
  });

  // 3. GROUP BY ACTION TITLE: Aggregate compliance task strings into matching structural keys
  const complianceGroups = targetEstimatorTasks.reduce((groups, task) => {
    const title = task.actionTitle || "Compliance Task";
    if (!groups[title]) groups[title] = [];
    
    // Cross-reference with our pre-loaded jobs array
    const matchingEstimate = jobs.find(j => j.jobNumber === task.jobNumber);
    
    if (matchingEstimate) {
      groups[title].push(matchingEstimate);
    } else {
      // Fallback placeholder object if a compliance job code hasn't loaded in the report cache
      groups[title].push({
        uniqueId: `compliance-${task.jobNumber}`,
        jobNumber: task.jobNumber,
        customer: "Unknown Customer",
        description: "Compliance Assignment"
      });
    }
    return groups;
  }, {});

  return html`
    <div class="sidebar">
      ${sections.map(sec => {
        const list = filteredJobs.filter(sec.f);
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

      ${Object.keys(complianceGroups).map(actionTitle => {
        const matchedGroupJobs = complianceGroups[actionTitle];
        return html`
          <div>
            <h4 style="border-bottom: 2px solid #e67e22; color: #e67e22;">
              ${actionTitle.toUpperCase()} (${matchedGroupJobs.length})
            </h4>
            
            ${matchedGroupJobs.map(j => html`
              <div class="sidebar-item" style="border-left: 3px solid #e67e22;" 
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