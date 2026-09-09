interface FilterGroupProps {
  divisions: string[];
  onFilterChange: (selected: string[]) => void;
}

export const FilterGroup = ({ divisions, onFilterChange }: FilterGroupProps) => {
  return (
    <div class="filter-group">
      <label>Divisions:</label>
      <select
        id="division-filter"
        class="multi-select-dropdown"
        multiple
        size={1}
        onChange={(e) => {
          const select = e.target as HTMLSelectElement;
          const selected = Array.from(select.selectedOptions).map(opt => opt.value);
          onFilterChange(selected);
        }}
      >
        {divisions.map((div) => (
          <option key={div} value={div} selected>
            {div}
          </option>
        ))}
      </select>
    </div>
  );
};