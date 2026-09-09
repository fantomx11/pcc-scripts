import type { Estimate } from '../classes/Estimate';

interface JobCardProps {
  est: Estimate;
  onOpen: () => void;
}

export const JobCard = ({ est, onOpen }: JobCardProps) => {
  const severity = est.aging >= 10 ? 'danger' : (est.aging >= 5 ? 'warning' : 'normal');
  const isProduction = est.phase?.kanbanGroup === 'group-pm';

  return (
    <div
      class={`job-card ${est.isManual ? 'manual' : ''} ${severity}`}
      onClick={onOpen}
    >
      <div class="aging-tag">{est.aging}d</div>
      <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
        <a
          href={est.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {est.jobNumber}
        </a>
      </div>
      <div style={{ fontSize: '11px', color: '#666' }}>
        {est.customer} - {est.description}
      </div>

      {isProduction && (
        <div class="job-progress-container" style={{ marginTop: '8px', marginBottom: '4px' }}>
          <div style={{ background: '#e0e0e0', borderRadius: '4px', height: '6px', width: '100%', overflow: 'hidden' }}>
            <div
              style={{
                background: '#27ae60',
                height: '100%',
                width: `${Math.min(100, Math.max(0, est.jobCompleted * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      <div class="badges">
        {est.xactId && (
          <span class="badge badge-manual">
            <a
              href={`https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${est.xactId}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              XACT
            </a>
          </span>
        )}
        {est.tasks?.needsContact && <span class="badge badge-urgent">CONTACT DUE</span>}
        {(est.tasks?.needsWorkAuth || est.tasks?.needsSignedCO) && (
          <span class="badge badge-auth">NEED AUTH</span>
        )}
      </div>
    </div>
  );
};