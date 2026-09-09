import type { FunctionalComponent } from 'preact';

export interface CellData {
  text?: string;
  url?: string;
  background?: string;
  className?: string;
}

interface TableCellProps {
  cellData: CellData;
}

export const TableCell: FunctionalComponent<TableCellProps> = ({ cellData }) => {
  const tdClassName = `table-cell ${cellData.background || ''} ${cellData.className || ''}`.trim();

  return (
    <td class={tdClassName}>
      {cellData.url ? (
        <a href={cellData.url} target="_blank" rel="noopener noreferrer">
          {cellData.text}
        </a>
      ) : (
        cellData.text
      )}
    </td>
  );
};