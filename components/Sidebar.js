// components/Sidebar.js
const { useState } = await import('https://esm.sh/preact/hooks');
const { html } = await import("../modules/lib.js");

export const Sidebar = ({ jobs, activeEstimator, complianceTasks = [] }) => {
  const [collapsed, setCollapsed] = useState({});

  const toggleSection = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedDivisions = Array.from(document.getElementById('division-filter')?.selectedOptions || []).map(opt => opt.value);

  if(complianceTasks === null) complianceTasks = [];
  
  // 1. Core local task sections and their theme color definitions
  const sections = [
    { key: "contact-needed", t: "Contact Needed", f: j => j.tasks.needsContact, c: "#e74c3c" },
    { key: "warranty-jobs", t: "Warranty Jobs", f: j => j.division === "Warranty", c: "#3498db" },
    { key: "needs-work-auth", t: "Needs Work Auth", f: j => j.tasks.needsWorkAuth, c: "#8e44ad" },
    { key: "needs-signed-co", t: "Needs Signed CO", f: j => j.tasks.needsSignedCO, c: "#8e44ad" },
    { key: "enter-deductible", t: "Enter Deductible", f: j => j.tasks.needsDeductible, c: "#d35400" }
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
        const isCollapsed = !collapsed[sec.key];

        return html`
          <div>
            <h4 class="sidebar-header" onClick=${() => toggleSection(sec.key)}>
              <span>${sec.t} (${list.length})</span>
              <span class="collapse-icon">${isCollapsed ? '▶' : '▼'}</span>
            </h4>
            ${!isCollapsed && list.map(j => html`
              <div class="sidebar-item" style="border-left: 3px solid ${sec.c}" 
                    onClick=${() => window.App.openModal(j.uniqueId)}>
                <b><a href="${j.url}" target="_blank" onClick=${(e) => e.stopPropagation()}>${j.jobNumber}</a></b><br/>${j.customer} - ${j.description}
              </div>
            `)}
          </div>
        `;
      })}

      ${Object.keys(complianceGroups).map(actionTitle => {
        const matchedGroupJobs = complianceGroups[actionTitle];
        const groupKey = `compliance-${actionTitle}`;
        const isCollapsed = !collapsed[groupKey];

        return html`
          <div>
            <h4 class="sidebar-header" style="border-bottom: 2px solid #e67e22; color: #e67e22;" onClick=${() => toggleSection(groupKey)}>
              <span>${actionTitle.toUpperCase()} (${matchedGroupJobs.length})</span>
              <span class="collapse-icon">${isCollapsed ? '▶' : '▼'}</span>
            </h4>
            
            ${!isCollapsed && matchedGroupJobs.map(j => {
              const est = jobs.find(job => job.jobNumber === j.jobNumber);
                
              return html`
              <div class="sidebar-item" style="border-left: 3px solid #e67e22;" 
                    onClick=${() => window.App.openModal(j.uniqueId)}>
                <b><a href="${est?.url}" target="_blank" onClick=${(e) => e.stopPropagation()}>${j.jobNumber}</a></b><br/>${j.customer} - ${j.description}
              </div>
            `})}
          </div>
        `;
      })}
    </div>
  `;
};