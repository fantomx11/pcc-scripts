import type { ColumnDetectionResult, ColumnMapping } from '../types';

export class ColumnMapper {
  static detect(headers: string[], sampleRows: string[][]): ColumnDetectionResult {
    const headerLower = headers.map((h) => h.toLowerCase().trim());

    const find = (aliases: string[], requireNumeric = false): string | null => {
      for (const alias of aliases) {
        for (let i = 0; i < headerLower.length; i++) {
          const h = headerLower[i];
          const cleanH = h.replace(/[^a-z0-9]/g, '');
          const cleanAlias = alias.replace(/[^a-z0-9]/g, '');

          if (cleanH === cleanAlias) {
            if (requireNumeric && sampleRows.length > 0) {
              const vals = sampleRows.slice(0, 5).map((r) => (r[i] || '').trim().toLowerCase());
              if (vals.some((v) => v === 'yes' || v === 'no')) continue;
            }
            return headers[i];
          }
        }
      }
      return null;
    };

    const mapping: ColumnMapping = {
      group: find(['group description', 'group', 'room', 'area', 'location']),
      lineNum: find(['#', 'line number', 'line', 'item #', 'item no', 'item']),
      description: find(['desc', 'description', 'item description']),
      quantity: find(['qty', 'quantity', 'calc']),
      unit: find(['unit', 'uom']),
      tax: find(['sales tax', 'tax amt', 'tax amount', 'tax dollar'], true) || find(['tax'], true),
      rcv: find(['rcv', 'replacement cost value', 'total']),

      gcop: find(['gco&p', 'gcop', 'o&p', 'op', 'overhead & profit']),
      itemAmount: find(['item amount', 'base amount', 'total cost', 'amount']),
      unitPrice: find(['unit cost', 'unit price', 'price']),

      category: find(['cat', 'category', 'trade']),
      selector: find(['sel', 'selector', 'code']),
      activity: find(['activity', 'act', 'action']),
      material: find(['material', 'mat', 'unit material']),
      wage: find(["worker's wage", 'wage', 'labor wage']),
      burden: find(['labor burden', 'burden']),
      overhead: find(['labor overhead', 'labor o&h']),
      equipment: find(['equipment', 'equip', 'equ']),
      market: find(['market conditions', 'market', 'mkt']),
      groupCode: find(['group code', 'room code']),
      note: find(['note 1', 'note', 'line note', 'notes']),
    };

    const hasCore = Boolean(
      mapping.group &&
      mapping.description &&
      mapping.quantity &&
      mapping.unit &&
      mapping.tax &&
      mapping.rcv
    );

    const hasFinancialBase = Boolean(mapping.gcop || mapping.itemAmount || mapping.unitPrice);
    const isComplete = Boolean(hasCore && hasFinancialBase);
    const isEnriched = Boolean(mapping.category || mapping.material);

    return { mapping, isComplete, isEnriched };
  }
}