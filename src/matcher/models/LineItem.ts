import { escapeXml, type RawLineItemData } from '../types';

export class LineItem {
  group: string;
  groupCode: string;
  lineNum: number;
  description: string;
  quantity: number;
  unit: string;
  tax: number;
  rcv: number;

  rawGcop: number | null;
  rawItemAmount: number | null;
  rawUnitPrice: number | null;

  category: string;
  selector: string;
  activity: string;

  rawMaterial: number | null;
  rawWage: number | null;
  rawBurden: number | null;
  rawOverhead: number | null;
  rawEquipment: number;
  rawMarket: number;
  note: string;

  baseCost = 0;
  materialTotal = 0;
  laborTotal = 0;
  unitMaterial = 0;
  unitLabor = 0;
  unitPrice = 0;

  constructor(data: RawLineItemData) {
    this.group = (data.group || 'General').trim();
    this.groupCode = (data.groupCode || '').trim();
    this.lineNum = parseInt(String(data.lineNum), 10) || 1;
    this.description = (data.description || '').trim();
    this.quantity = parseFloat(String(data.quantity).replace(/,/g, '')) || 0;
    this.unit = (data.unit || 'EA').trim().toUpperCase();
    this.tax = parseFloat(String(data.tax).replace(/,/g, '')) || 0;
    this.rcv = parseFloat(String(data.rcv).replace(/,/g, '')) || 0;

    this.rawGcop = data.gcop !== undefined && data.gcop !== null ? parseFloat(String(data.gcop).replace(/,/g, '')) : null;
    this.rawItemAmount = data.itemAmount !== undefined && data.itemAmount !== null ? parseFloat(String(data.itemAmount).replace(/,/g, '')) : null;
    this.rawUnitPrice = data.unitPrice !== undefined && data.unitPrice !== null ? parseFloat(String(data.unitPrice).replace(/,/g, '')) : null;

    this.category = (data.category || '').trim().toUpperCase();
    this.selector = (data.selector || 'MISC').trim().toUpperCase();
    this.activity = this.normalizeActivity(data.activity);

    this.rawMaterial = data.material !== undefined && data.material !== null ? parseFloat(String(data.material).replace(/,/g, '')) : null;
    this.rawWage = data.wage !== undefined && data.wage !== null ? parseFloat(String(data.wage).replace(/,/g, '')) : null;
    this.rawBurden = data.burden !== undefined && data.burden !== null ? parseFloat(String(data.burden).replace(/,/g, '')) : null;
    this.rawOverhead = data.overhead !== undefined && data.overhead !== null ? parseFloat(String(data.overhead).replace(/,/g, '')) : null;
    this.rawEquipment = data.equipment !== undefined && data.equipment !== null ? parseFloat(String(data.equipment).replace(/,/g, '')) : 0;
    this.rawMarket = data.market !== undefined && data.market !== null ? parseFloat(String(data.market).replace(/,/g, '')) : 0;
    this.note = (data.note || '').trim();
  }

  private normalizeActivity(act?: string): string {
    if (!act) return '+';
    const clean = act.trim().toLowerCase();
    if (clean === 'replace' || clean === '+') return '+';
    if (clean === 'remove' || clean === '-') return '-';
    if (clean.includes('detach') || clean === '&') return '&';
    if (clean.includes('material')) return 'M';
    if (clean.includes('install')) return 'I';
    return '+';
  }

  calculateFinancials(taxRateDecimal: number): void {
    if (this.rawItemAmount !== null) {
      this.baseCost = this.rawItemAmount;
    } else if (this.rawGcop !== null) {
      this.baseCost = this.rcv - this.tax - this.rawGcop;
    } else if (this.rawUnitPrice !== null && this.quantity > 0) {
      this.baseCost = this.quantity * this.rawUnitPrice;
    } else {
      this.baseCost = this.rcv - this.tax;
    }

    if (this.rawMaterial !== null && !isNaN(this.rawMaterial)) {
      this.unitMaterial = this.rawMaterial;
      this.materialTotal = this.unitMaterial * this.quantity;
    } else {
      this.materialTotal = taxRateDecimal > 0 ? (this.tax / taxRateDecimal) : 0;
      this.unitMaterial = this.quantity > 0 ? (this.materialTotal / this.quantity) : 0;
    }

    if (this.rawWage !== null || this.rawOverhead !== null) {
      this.unitLabor = (this.rawWage || 0) + (this.rawBurden || 0) + (this.rawOverhead || 0);
      this.laborTotal = this.unitLabor * this.quantity;
    } else {
      this.laborTotal = Math.max(0, this.baseCost - this.materialTotal);
      this.unitLabor = this.quantity > 0 ? (this.laborTotal / this.quantity) : 0;
    }

    this.unitPrice = this.quantity > 0 ? (this.baseCost / this.quantity) : (this.unitMaterial + this.unitLabor);
  }

  toSumItemXml(sumId: string, catId: string): string {
    const escDesc = escapeXml(this.description);
    const selCode = escapeXml(this.selector || 'MISC');
    const catCode = escapeXml(this.category || 'PNT');

    return `
      <SUMITEM id="${sumId}" cat="${catCode}" catId="${catId}" sel="${selCode}" act="${this.activity}" desc="${escDesc}" unit="${this.unit}" depMax="100" coverage="1" descMod="1" owner="SAM">
        <MIL_ITEM_INFOS><MIL_ITEM_INFO/><MIL_ITEM_INFO/></MIL_ITEM_INFOS>
        <SUM_ACTIVITIES>
          <SUM_ACTIVITY act="${this.activity}" labMarkup="0" matCS="${this.unitMaterial.toFixed(4)}" equ="${this.rawEquipment.toFixed(4)}" mkt="${this.unitLabor.toFixed(4)}" phs="112">
            <SUM_ASSEMBLIES/>
          </SUM_ACTIVITY>
        </SUM_ACTIVITIES>
        <HISTORY/>
        <PCA_RECONS/>
      </SUMITEM>`;
  }

  toItemXml(itemId: string, sumId: string): string {
    return `
      <ITEM id="${itemId}" type="S" dateTimeStamp="${new Date().toISOString()}" addedByUser="SAM" user="SAM" owner="SAM">
        <SUMMARY_REF sumRef="${sumId}" calc="${this.quantity}" qty="${this.quantity}" depType="P" recoverable="1" lineNum="${this.lineNum}"/>
      </ITEM>`;
  }
}