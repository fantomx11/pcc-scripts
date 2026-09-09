import { useState } from 'preact/hooks';
import type { Estimate } from '../classes/Estimate';
import type { ComplianceTask } from '../modules/compliance';

interface SidebarProps {
  jobs: Estimate[];
  activeEstimator: string;
  selectedDivs?: string[];
  complianceTasks?: ComplianceTask[] | null;
}

export const Sidebar = ({
  jobs,
  activeEstimator,
  selectedDivs,
  complianceTasks = [],
}: SidebarProps) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeDivisions = selectedDivs || Array.from(
    (document.getElementById('division-filter') as HTMLSelectElement)?.selectedOptions || []
  ).map(opt => opt.value);

  const safeComplianceTasks = complianceTasks || [];

  const sections = [
    { key: 'contact-needed', t: 'Contact Needed', f: (j: Estimate) => Boolean(j.tasks?.needsContact), c: '#e74c3c' },
    { key: 'warranty-jobs', t: 'Warranty Jobs', f: (j: Estimate) => j.division === 'Warranty', c: '#3498db' },
    { key: 'needs-work-auth', t: 'Needs Work Auth', f: (j: Estimate) => Boolean(j.tasks?.needsWorkAuth), c: '#8e44ad' },
    { key: 'needs-signed-co', t: 'Needs Signed CO', f: (j: Estimate) => Boolean(j.tasks?.needsSignedCO), c: '#8e44ad' },
    { key: 'enter-deductible', t: 'Enter Deductible', f: (j: Estimate) => Boolean(j.tasks?.needsDeductible), c: '#d35400' },
  ];

  const filteredJobs = jobs.filter(e => {
    const estimatorMatch = (activeEstimator === 'All' ? true : e.estimator === activeEstimator);
    const divisionMatch = activeDivisions.length === 0 || activeDivisions.includes(e.division || '');
    return estimatorMatch && divisionMatch;
  });

  const targetEstimatorTasks = safeComplianceTasks.filter(task => {
    return activeEstimator === 'All' || task.estimatorName === activeEstimator;
  });

  const complianceGroups = targetEstimatorTasks.reduce((groups, task) => {
    const title = task.actionTitle || 'Compliance Task';
    if (!groups[title]) groups[title] = [];

    const matchingEstimate = jobs.find(j => j.jobNumber === task.jobNumber);
    if (matchingEstimate) {
      groups[title].push(matchingEstimate);
    } else {
      groups[title].push({
        uniqueId: `compliance-${task.jobNumber}`,
        jobNumber: task.jobNumber,
        customer: 'Unknown Customer',
        description: 'Compliance Assignment',
      } as any);
    }
    return groups;
  }, {} as Record<string, Estimate[]>);

  return (
    <div class="sidebar">
      {sections.map(sec => {
        const list = filteredJobs.filter(sec.f);
        if (!list.length) return null;
        const isCollapsed = !collapsed[sec.key];

        return (
          <div key={sec.key}>
            <h4 class="sidebar-header" onClick={() => toggleSection(sec.key)}>
              <span>{sec.t} ({list.length})</span>
              <span class="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
            </h4>
            {!isCollapsed && list.map(j => (
              <div
                key={j.uniqueId}
                class="sidebar-item"
                style={{ borderLeft: `3px solid ${sec.c}` }}
                onClick={() => (window as any).App?.openModal(j.uniqueId)}
              >
                <b>
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {j.jobNumber}
                  </a>
                </b>
                <br />
                {j.customer} - {j.description}
              </div>
            ))}
          </div>
        );
      })}

      {Object.keys(complianceGroups).map(actionTitle => {
        const matchedGroupJobs = complianceGroups[actionTitle];
        const groupKey = `compliance-${actionTitle}`;
        const isCollapsed = !collapsed[groupKey];

        return (
          <div key={groupKey}>
            <h4
              class="sidebar-header"
              style={{ borderBottom: '2px solid #e67e22', color: '#e67e22' }}
              onClick={() => toggleSection(groupKey)}
            >
              <span>{actionTitle.toUpperCase()} ({matchedGroupJobs.length})</span>
              <span class="collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
            </h4>

            {!isCollapsed && matchedGroupJobs.map(j => {
              const est = jobs.find(job => job.jobNumber === j.jobNumber);
              return (
                <div
                  key={j.uniqueId}
                  class="sidebar-item"
                  style={{ borderLeft: '3px solid #e67e22' }}
                  onClick={() => (window as any).App?.openModal(j.uniqueId)}
                >
                  <b>
                    <a
                      href={est?.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {j.jobNumber}
                    </a>
                  </b>
                  <br />
                  {j.customer} - {j.description}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};