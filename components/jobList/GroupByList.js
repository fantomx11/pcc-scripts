import { html } from "../../modules/lib.js";

export const GroupByList = ({ groupBy,  setGroupBy }) => {
  return html`
    <div class="group-by-list">
      <b>Group By:</b> ${
        ["estimator", "supervisor", "foreman", "accountingPerson"].map((k, i) => {
          return html`
            <label key=${i}>
              <input type="radio" name="grp" value="${k}" checked=${k === groupBy} onChange=${e => setGroupBy(e.target.value)}> ${k.charAt(0).toUpperCase() + k.slice(1)} />
            </label>
          `;
        }      
      )}
    </div>
  `;
};