const {html} = await import("../modules/libs.js");

export const JobCard = ({ est, onOpen }) => {
  const severity = est.aging >= 10 ? 'danger' : (est.aging >= 5 ? 'warning' : 'normal');

  return html`
    <div class=${`job-card ${est.isManual ? 'manual' : ''} ${severity}`} onClick=${onOpen}>
      <div class="aging-tag">${est.aging}d</div>
      <div style="font-weight:bold; font-size:12px;">
          <a href="${est.url}" target="_blank" onClick=${(e) => e.stopPropagation()}>${est.jobNumber}</a>
      </div>
      <div style="font-size:11px; color:#666;">${est.customer} - ${est.description}</div>
      <div class="badges">
          ${est.xactId && html`<span class="badge badge-manual"><a href="https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${est.xactId}" target="_blank">XACT</a></span>`}
          ${est.tasks.needsContact && html`<span class="badge badge-urgent">CONTACT DUE</span>`}
          ${(est.tasks.needsWorkAuth || est.tasks.needsSignedCO) && html`<span class="badge badge-auth">NEED AUTH</span>`}
      </div>
    </div>
  `;
};
