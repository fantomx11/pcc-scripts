const {html} = await import("../modules/lib.js");

const { html } = await import("../modules/lib.js");

export const EstimatorTabs = ({ estimates, activeTab, selectedDivs, onTabChange }) => {
  const passesFilter = (job) => selectedDivs.length === 0 || selectedDivs.includes(job.division);

  const estimators = [
    ...new Set([
      ...estimates.map(e => e.estimator), 
      ...estimates.map(e => e.supervisor)
    ].filter(e => e.length > 0 && e !== "Unassigned"))
  ].sort();

  const allCount = estimates.filter(e => e.isActive && passesFilter(e)).length;

  return html`
    <div class="estimator-dropdown-container">
      <label class="estimator-dropdown-label">Estimator / PM:</label>
      <select 
        class="estimator-dropdown" 
        value=${activeTab} 
        onChange=${(e) => onTabChange(e.target.value)}
      >
        <option value="All">All (${allCount})</option>
        ${estimators.map(est => {
          const count = estimates.filter(
            e => (e.estimator === est || e.supervisor === est) && e.isActive && passesFilter(e)
          ).length;

          return html`
            <option value="${est}">
              ${est} (${count})
            </option>
          `;
        })}
      </select>
    </div>
  `;
};