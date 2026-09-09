import type { FunctionalComponent } from 'preact';
import { camelToCapitalCase } from '../../modules/lib';

interface GroupByListProps {
  groupBy: string;
  setGroupBy: (key: string) => void;
}

const GROUP_KEYS = ['estimator', 'supervisor', 'accountingPerson'];

export const GroupByList: FunctionalComponent<GroupByListProps> = ({
  groupBy,
  setGroupBy,
}) => {
  return (
    <div class="group-by-list">
      <b>Group By:</b>{' '}
      {GROUP_KEYS.map((key) => (
        <label key={key} style={{ marginLeft: '8px' }}>
          <input
            type="radio"
            name="grp"
            value={key}
            checked={key === groupBy}
            onChange={(e) => setGroupBy((e.target as HTMLInputElement).value)}
          />{' '}
          {camelToCapitalCase(key)}
        </label>
      ))}
    </div>
  );
};