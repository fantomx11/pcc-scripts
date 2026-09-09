import { LineItem } from './LineItem';

export interface GroupData {
  description: string;
  code: string;
  items: LineItem[];
}

export class EstimateModel {
  projectId = '';
  customerName = '';
  salesTaxRate: number | null = null;
  items: LineItem[] = [];
  categoryMappings = new Map<string, string>();
  isEnrichedSource = false;

  setProjectId(id: string): void {
    this.projectId = (id || '').trim().toUpperCase().slice(0, 20);
  }

  setCustomerName(name: string): void {
    this.customerName = (name || '').trim();
  }

  setTaxRate(rate: string | number | null): void {
    if (rate === null || rate === '') {
      this.salesTaxRate = null;
      return;
    }
    const parsed = parseFloat(String(rate).replace('%', '').trim());
    this.salesTaxRate = isNaN(parsed) ? null : parsed;
  }

  getFormattedFilename(): string {
    const cleanId = (this.projectId || 'PROJECT').trim().toUpperCase().slice(0, 20);
    const formattedCustomer = (this.customerName || 'CUSTOMER').trim().replace(/\s+/g, '~S');
    return `${cleanId} ${formattedCustomer}.esx`;
  }

  addLineItem(item: LineItem): void {
    this.items.push(item);
    if (item.category && item.category.length === 3) {
      this.categoryMappings.set(item.description, item.category);
    }
  }

  recalculateAll(): void {
    if (this.salesTaxRate === null || this.salesTaxRate <= 0) {
      throw new Error('A valid material sales tax rate greater than 0% is required.');
    }
    const taxRateDecimal = this.salesTaxRate / 100;
    this.items.forEach((item) => {
      if (this.categoryMappings.has(item.description)) {
        item.category = this.categoryMappings.get(item.description)!;
      }
      item.calculateFinancials(taxRateDecimal);
    });
  }

  getUniqueDescriptions(): string[] {
    return Array.from(new Set(this.items.map((i) => i.description)));
  }

  isDescriptionMapped(desc: string): boolean {
    return this.categoryMappings.has(desc) && (this.categoryMappings.get(desc)?.length === 3);
  }

  mapCategory(desc: string, categoryCode: string): void {
    this.categoryMappings.set(desc, categoryCode.toUpperCase());
  }

  isFullyMapped(): boolean {
    const unique = this.getUniqueDescriptions();
    return unique.length > 0 && unique.every((desc) => this.isDescriptionMapped(desc));
  }

  hasValidSettings(): boolean {
    return (
      this.projectId.length > 0 &&
      this.customerName.length > 0 &&
      this.salesTaxRate !== null &&
      this.salesTaxRate > 0
    );
  }

  getDistinctCategories(): string[] {
    const cats = new Set<string>();
    this.items.forEach((i) => {
      if (i.category) cats.add(i.category);
    });
    if (cats.size === 0) cats.add('PNT');
    return Array.from(cats);
  }

  getItemsByGroup(): Map<string, GroupData> {
    const groups = new Map<string, GroupData>();
    this.items.forEach((item) => {
      const key = item.group || 'General';
      if (!groups.has(key)) {
        groups.set(key, {
          description: key,
          code: item.groupCode || key.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 15),
          items: [],
        });
      }
      groups.get(key)!.items.push(item);
    });
    return groups;
  }

  getTotalRcv(): number {
    return this.items.reduce((acc, i) => acc + i.rcv, 0);
  }
}