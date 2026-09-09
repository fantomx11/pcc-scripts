import type { Estimate } from '../classes/Estimate';

interface EstimatorTabsProps {
  estimates: Estimate[];
  activeTab: string;
  selectedDivs: string[];
  onTabChange: (tab: string) => void;
}

export const EstimatorTabs = ({
  estimates,
  activeTab,
  selectedDivs,
  onTabChange,
}: EstimatorTabsProps) => {
  const passesFilter = (job: Estimate): boolean =>
    selectedDivs.length === 0 || selectedDivs.includes(job.division || '');

  const estimators = [
    ...new Set([
      ...estimates.map(e => e.estimator || ''),
      ...estimates.map(e => e.supervisor || ''),
    ].filter(e => e.length > 0 && e !== 'Unassigned')),
  ].sort();

  const allCount = estimates.filter(e => e.isActive && passesFilter(e)).length;

  return (
    <div class="estimator-dropdown-container">
      <label class="estimator-dropdown-label">Estimator / PM:</label>
      <select
        class="estimator-dropdown"
        value={activeTab}
        onChange={(e) => onTabChange((e.target as HTMLSelectElement).value)}
      >
        <option value="All">All ({allCount})</option>
        {estimators.map((est) => {
          const count = estimates.filter(
            e => (e.estimator === est || e.supervisor === est) && e.isActive && passesFilter(e)
          ).length;

          return (
            <option key={est} value={est}>
              {est} ({count})
            </option>
          );
        })}
      </select>
    </div>
  );
};