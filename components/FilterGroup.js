const {html} = await import("../modules/libs.js");

export const FilterGroup = ({ divisions, onFilterChange }) => {
  return html`
    <div class="filter-group">
      <label>Divisions:</label>
      <select 
        id="division-filter" 
        class="multi-select-dropdown" 
        multiple 
        size="1"
        onChange=${(e) => {
          const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
          onFilterChange(selected);
        }}
      >
        ${divisions.map(div => html`
          <option value="${div}" selected>${div}</option>
        `)}
      </select>
    </div>
  `;
};