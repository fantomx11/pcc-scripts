const {html} = await import("../modules/libs.js");

export const EstimatorTabs = ({ estimates, activeTab, selectedDivs, onTabChange }) => {
  const passesFilter = (job) => selectedDivs.length === 0 || selectedDivs.includes(job.division);

  // Calculate estimators from the data
  const estimators = [...new Set(estimates.map(e => e.estimator))].sort();

  return html`
    <div class="tabs">
      <button 
        class=${`tab-btn ${activeTab === 'All' ? 'active' : ''}`} 
        onClick=${() => onTabChange('All')}
      >
        All (${estimates.filter(e => e.isActive && passesFilter(e)).length})
      </button>
      
      ${estimators.map(est => {
    const count = estimates.filter(e => e.estimator === est && e.isActive && passesFilter(e)).length;
    return html`
          <button 
            class=${`tab-btn ${activeTab === est ? 'active' : ''}`} 
            onClick=${() => onTabChange(est)}
          >
            ${est} (${count})
          </button>
        `;
  })}
    </div>
  `;
};