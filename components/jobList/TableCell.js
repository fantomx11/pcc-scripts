import { html } from '../../modules/lib.js';

export function TableCell({ cellData }) {
  const tdClassName = `table-cell ${cellData.background || ''} ${cellData.className || ''}`.trim();

  return html`
    <td class=${tdClassName}>
      ${
        cellData.url ? html`<a href=${cellData.url} target="_blank">${cellData.text}</a>` : cellData.text
      }
    </td>
  `;
}