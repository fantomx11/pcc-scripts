export interface RawLineItemData {
  group?: string;
  groupCode?: string;
  lineNum?: number | string;
  description?: string;
  quantity?: number | string;
  unit?: string;
  tax?: number | string;
  rcv?: number | string;
  gcop?: number | string | null;
  itemAmount?: number | string | null;
  unitPrice?: number | string | null;
  category?: string;
  selector?: string;
  activity?: string;
  material?: number | string | null;
  wage?: number | string | null;
  burden?: number | string | null;
  overhead?: number | string | null;
  equipment?: number | string | null;
  market?: number | string | null;
  note?: string;
}

export interface ColumnMapping {
  group: string | null;
  lineNum: string | null;
  description: string | null;
  quantity: string | null;
  unit: string | null;
  tax: string | null;
  rcv: string | null;
  gcop: string | null;
  itemAmount: string | null;
  unitPrice: string | null;
  category: string | null;
  selector: string | null;
  activity: string | null;
  material: string | null;
  wage: string | null;
  burden: string | null;
  overhead: string | null;
  equipment: string | null;
  market: string | null;
  groupCode: string | null;
  note: string | null;
}

export interface ParsedCsv {
  headers: string[];
  dataRows: string[][];
}

export interface ColumnDetectionResult {
  mapping: ColumnMapping;
  isComplete: boolean;
  isEnriched: boolean;
}

export interface TaxRateDetectionResult {
  rate: number;
  method: string;
}

export function escapeXml(unsafe: unknown): string {
  return String(unsafe ?? '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}