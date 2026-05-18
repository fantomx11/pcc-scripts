import { html } from "../../modules/lib.js";

export const JobDetails = ({ job }) => {
  const {customerName, url, ...other} = job;

  return html`
    <div>
      <h3>${job.customerName}</h3>
      ${
        Object.keys(other).map((item, index) => html`
          <p key=${index}><b>${item}:</b> ${other[item]}</p>
        `)
      }
    </div>
  `;
};