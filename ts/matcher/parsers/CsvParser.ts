import type { ParsedCsv } from '../types';

export class CsvParser {
  static parse(text: string): ParsedCsv {
    const cleanText = text.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    let i = 0;

    while (i < cleanText.length) {
      const char = cleanText[i];
      if (char === '"') {
        if (inQuotes && i + 1 < cleanText.length && cleanText[i + 1] === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && i + 1 < cleanText.length && cleanText[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentVal.trim());
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
      i++;
    }

    if (currentVal.length > 0 || currentRow.length > 0) {
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) throw new Error('The uploaded CSV file is empty.');

    const headers = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);
    return { headers, dataRows };
  }
}