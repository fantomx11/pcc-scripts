import { html, camelToCapitalCase } from "../../modules/lib.js";

export const JobDetails = ({ job }) => {
  const {customer, url, rowNumber, jobId, jobFlagLevel, flagged, ...other} = job;

  return html`
    <div>
      <h3>${job.customer}</h3>
      ${
        Object.keys(other).map((item, index) => html`
          <p key=${index}><b>${camelToCapitalCase(item)}:</b> ${other[item]}</p>
        `)
      }
    </div>
  `;
};