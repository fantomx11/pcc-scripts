import { html, camelToCapitalCase } from "../../modules/lib.js";

export const GroupByList = ({ groupBy,  setGroupBy }) => {
  return html`
    <div class="group-by-list">
      <b>Group By:</b> ${
        ["estimator", "supervisor", "accountingPerson"].map((k, i) => {
          return html`
            <label key=${i}>
              <input type="radio" name="grp" value=${k} checked=${k === groupBy} onChange=${e => setGroupBy(e.target.value)} /> ${camelToCapitalCase(k)}
            </label>
          `;
        }      
      )}
    </div>
  `;
};