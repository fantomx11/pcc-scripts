import type { ColumnMapping, TaxRateDetectionResult } from '../types';

export class TaxRateDetector {
  static detect(
    headers: string[],
    rows: string[][],
    mapping: ColumnMapping
  ): TaxRateDetectionResult | null {
    if (mapping.material && mapping.quantity && mapping.tax) {
      const matIdx = headers.indexOf(mapping.material);
      const qtyIdx = headers.indexOf(mapping.quantity);
      const taxIdx = headers.indexOf(mapping.tax);

      let totalMat = 0;
      let totalTax = 0;
      const lineData: { mat: number; tax: number }[] = [];

      rows.forEach((r) => {
        const q = parseFloat(String(r[qtyIdx] || '0').replace(/,/g, '')) || 0;
        const m = parseFloat(String(r[matIdx] || '0').replace(/,/g, '')) || 0;
        const t = parseFloat(String(r[taxIdx] || '0').replace(/,/g, '')) || 0;
        if (q > 0 && m > 0 && t > 0) {
          totalMat += q * m;
          totalTax += t;
          lineData.push({ mat: q * m, tax: t });
        }
      });

      if (totalMat > 0 && lineData.length > 0) {
        const rawRate = (totalTax / totalMat) * 100;
        let bestRate = rawRate;
        let minDiff = Infinity;
        const startStep = Math.round((rawRate - 0.25) * 1000);
        const endStep = Math.round((rawRate + 0.25) * 1000);

        for (let s = startStep; s <= endStep; s++) {
          const testRate = s / 1000;
          let diff = 0;
          for (let i = 0; i < lineData.length; i++) {
            const expectedTax = Math.round(lineData[i].mat * (testRate / 100) * 100) / 100;
            diff += Math.abs(expectedTax - lineData[i].tax);
          }
          if (diff < minDiff) {
            minDiff = diff;
            bestRate = testRate;
            if (minDiff === 0) break;
          }
        }
        return { rate: bestRate, method: 'Native Material Split' };
      }
    }

    if (mapping.description && mapping.tax && (mapping.unitPrice || mapping.itemAmount)) {
      const descIdx = headers.indexOf(mapping.description);
      const taxIdx = headers.indexOf(mapping.tax);
      const qtyIdx = headers.indexOf(mapping.quantity || '');
      const upIdx = mapping.unitPrice ? headers.indexOf(mapping.unitPrice) : -1;
      const amtIdx = mapping.itemAmount ? headers.indexOf(mapping.itemAmount) : -1;
      const actIdx = mapping.activity ? headers.indexOf(mapping.activity) : -1;

      let totalBase = 0;
      let totalTax = 0;

      rows.forEach((r) => {
        const desc = (r[descIdx] || '').toLowerCase();
        const act = actIdx !== -1 ? (r[actIdx] || '').toLowerCase() : '';
        const isMatOnly = desc.includes('mat. only') || desc.includes('material only') || act === 'm';

        if (isMatOnly) {
          const q = qtyIdx !== -1 ? (parseFloat(String(r[qtyIdx] || '1').replace(/,/g, '')) || 1) : 1;
          let base = 0;
          if (amtIdx !== -1 && r[amtIdx]) base = parseFloat(String(r[amtIdx]).replace(/,/g, '')) || 0;
          else if (upIdx !== -1 && r[upIdx]) base = q * (parseFloat(String(r[upIdx]).replace(/,/g, '')) || 0);

          const t = parseFloat(String(r[taxIdx] || '0').replace(/,/g, '')) || 0;
          if (base > 0 && t > 0) {
            totalBase += base;
            totalTax += t;
          }
        }
      });

      if (totalBase > 0) {
        const rawRate = (totalTax / totalBase) * 100;
        return { rate: parseFloat(rawRate.toFixed(3)), method: 'Material-Only Line Items' };
      }
    }

    return null;
  }
}