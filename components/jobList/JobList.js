import { html } from '../../modules/lib.js';

import { TableCell } from './TableCell.js';
import { CopyCell } from './CopyCell.js';

export function JobList({ listClass, tableClass, jobs, selectedJob, setSelectedJob, copyTextToClipboard, includeCopyCell, getUrl }) {
  return html`
    <div class="${listClass}">
      <table class="${tableClass}">
        <tbody>
          ${jobs.map(job => {
            const isSelected = selectedJob && selectedJob === job.jobNumber;
            const rowClass = `row-style ${isSelected ? 'selected-row' : ''}`.trim();
            return html`
              <tr key=${`dash-${job.jobNumber}`} class=${rowClass} onClick=${() => setSelectedJob(job.jobNumber)} >
                <${TableCell} cellData=${{ text: job.customerName, background: job.rowFlagClass || job.name?.background }} />
                <${TableCell} cellData=${{ text: job.jobNumber, url: getUrl(job), background: job.rowFlagClass || job.dash?.background }} />
                ${includeCopyCell && html`<${CopyCell} copyText=${job.copyJobNumber} copyTextToClipboard=${copyTextToClipboard} />`}
              </tr>
            `;
          })}
        </tbody>
      </table>
    </div>
  `;
}

