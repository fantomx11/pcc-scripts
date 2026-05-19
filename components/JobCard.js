const {html} = await import("../modules/lib.js");

export const JobCard = ({ est, onOpen }) => {
  const severity = est.aging >= 10 ? 'danger' : (est.aging >= 5 ? 'warning' : 'normal');
  const isProduction = est.phase?.kanbanGroup === 'group-pm';

  return html`
    <div class=${`job-card ${est.isManual ? 'manual' : ''} ${severity}`} onClick=${onOpen}>
      <div class="aging-tag">${est.aging}d</div>
      <div style="font-weight:bold; font-size:12px;">
          <a href="${est.url}" target="_blank" onClick=${(e) => e.stopPropagation()}>${est.jobNumber}</a>
      </div>
      <div style="font-size:11px; color:#666;">${est.customer} - ${est.description}</div>

      ${isProduction && html`
        <div class="job-progress-container" style="margin-top: 8px; margin-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; color: #555; margin-bottom: 2px;">
            <span>Completion</span>
            <strong>${est.jobCompleted}%</strong>
          </div>
          <div style="background: #e0e0e0; border-radius: 4px; height: 6px; width: 100%; overflow: hidden;">
            <div style="background: #27ae60; height: 100%; width: ${Math.min(100, Math.max(0, est.jobCompleted))}%"></div>
          </div>
        </div>
      `}

      <div class="badges">
          ${est.xactId && html`<span class="badge badge-manual"><a href="https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${est.xactId}" target="_blank"  onClick=${(e) => e.stopPropagation()}>XACT</a></span>`}
          ${est.tasks.needsContact && html`<span class="badge badge-urgent">CONTACT DUE</span>`}
          ${(est.tasks.needsWorkAuth || est.tasks.needsSignedCO) && html`<span class="badge badge-auth">NEED AUTH</span>`}
      </div>
    </div>
  `;
};
