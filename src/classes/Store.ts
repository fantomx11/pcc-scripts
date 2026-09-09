import { Estimate, type EstimateData } from './Estimate';

export type SyncStatus = 'syncing' | 'saved' | 'error' | 'syncing with Dash' | string;

export interface CloudPayload {
  companyId: string;
  manual: EstimateData[];
  overrides: Record<string, Partial<EstimateData>>;
}

const CONFIG = {
  KEYS: {
    MANUAL: 'manual_estimates_v8',
    OVERRIDE: 'cms_overrides_v1',
  },
};

export const Store = {
  all: new Map<string, Estimate>(),
  isSyncing: false,
  API_URL: 'https://script.google.com/macros/s/AKfycbyU3a4YSvJ8CMWNDXUHvyCT2wKrokmIQ60NAl9VIS-9RIB3y6lhsXlyPHCK5bKVNSIg/exec',
  _syncTimeout: null as any,

  onCacheRebuilt: null as ((updatedEstimates: Estimate[]) => void) | null,
  statusListener: null as ((status: SyncStatus) => void) | null,

  get<T = any>(key: string): T {
    return JSON.parse(
      localStorage.getItem(key) || (key.includes('overrides') ? '{}' : '[]')
    );
  },

  save(key: string, data: any): void {
    localStorage.setItem(key, JSON.stringify(data));
  },

  rebuildLocal(scrapedData: Record<string, any>[] = [], EstimateClass = Estimate): void {
    const manuals: EstimateData[] = this.get(CONFIG.KEYS.MANUAL);
    const overrides: Record<string, Partial<EstimateData>> = this.get(CONFIG.KEYS.OVERRIDE);
    this.all.clear();

    manuals.forEach(m => this.all.set(m.uniqueId || `cms-${m.jobNumber}`, new EstimateClass(m)));
    scrapedData.forEach(s => {
      const extra = overrides[s.jobNumber] || {};
      const est = new EstimateClass({ ...s, ...extra } as EstimateData);
      this.all.set(est.uniqueId, est);
    });

    if (typeof this.onCacheRebuilt === 'function') {
      this.onCacheRebuilt(Array.from(this.all.values()));
    }
  },

  async initialFetch(scrapedData: Record<string, any>[] = [], EstimateClass = Estimate): Promise<void> {
    this.updateStatusUI('syncing');
    try {
      const companyId = (window as any).mixpanelDashCompanyID || 'default';
      const resp = await fetch(`${this.API_URL}?companyId=${encodeURIComponent(companyId)}`);
      const cloudData = await resp.json();

      if (cloudData.manual) this.save(CONFIG.KEYS.MANUAL, cloudData.manual);
      if (cloudData.overrides) this.save(CONFIG.KEYS.OVERRIDE, cloudData.overrides);

      this.rebuildLocal(scrapedData, EstimateClass);
      this.updateStatusUI('saved');
    } catch (e) {
      console.error('Initial cloud sync download failed:', e);
      this.updateStatusUI('error');
    }
  },

  updateStatusUI(status: SyncStatus): void {
    this.isSyncing = status === 'syncing' || status === 'syncing with Dash';
    if (typeof this.statusListener === 'function') {
      this.statusListener(status);
    }
  },

  async push(): Promise<void> {
    this.updateStatusUI('syncing');
    const payload: CloudPayload = {
      companyId: (window as any).mixpanelDashCompanyID || 'default',
      manual: this.get(CONFIG.KEYS.MANUAL),
      overrides: this.get(CONFIG.KEYS.OVERRIDE),
    };

    try {
      await fetch(this.API_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      this.updateStatusUI('saved');
    } catch (e) {
      console.error('Cloud push sync write failed:', e);
      this.updateStatusUI('error');
    }
  },
};