const CONFIG = {
  KEYS: {
    MANUAL: "manual_estimates_v8",
    OVERRIDE: "cms_overrides_v1",
  }
};

export const Store = {
  all: new Map(),
  isSyncing: false,
  API_URL: "https://script.google.com/macros/s/AKfycbyU3a4YSvJ8CMWNDXUHvyCT2wKrokmIQ60NAl9VIS-9RIB3y6lhsXlyPHCK5bKVNSIg/exec",
  _syncTimeout: null,
  
  // New callback target to notify Preact when the cache changes
  onCacheRebuilt: null,
  statusListener: null,

  get(key) { return JSON.parse(localStorage.getItem(key) || (key.includes('overrides') ? "{}" : "[]")); },
  save(key, data) { localStorage.setItem(key, JSON.stringify(data)); },

  rebuildLocal(scrapedData, Estimate) {
    const manuals = this.get(CONFIG.KEYS.MANUAL);
    const overrides = this.get(CONFIG.KEYS.OVERRIDE);
    this.all.clear();

    manuals.forEach(m => this.all.set(m.uniqueId, new Estimate(m)));
    scrapedData.forEach(s => {
      const extra = overrides[s.jobNumber] || {};
      const est = new Estimate({ ...s, ...extra });
      this.all.set(est.uniqueId, est);
    });

    // Notify the UI layer to pull the fresh data array map if listener exists
    if (typeof this.onCacheRebuilt === 'function') {
      this.onCacheRebuilt(Array.from(this.all.values()));
    }
  },

  async initialFetch(scrapedData, Estimate) {
    this.updateStatusUI('syncing');
    try {
      const resp = await fetch(this.API_URL);
      const cloudData = await resp.json();

      if (cloudData.manual) this.save(CONFIG.KEYS.MANUAL, cloudData.manual);
      if (cloudData.overrides) this.save(CONFIG.KEYS.OVERRIDE, cloudData.overrides);

      // Rebuild the local internal state map from newly downloaded data
      this.rebuildLocal(scrapedData, Estimate);
      this.updateStatusUI('saved');
    } catch (e) {
      console.error("Initial cloud sync download failed:", e);
      this.updateStatusUI('error');
    }
  },

  updateStatusUI(status) {
    this.isSyncing = (status === 'syncing');
    if (typeof this.statusListener === 'function') {
      this.statusListener(status);
    }
  },

  async push() {
    this.updateStatusUI('syncing');
    const payload = {
      manual: this.get(CONFIG.KEYS.MANUAL),
      overrides: this.get(CONFIG.KEYS.OVERRIDE)
    };

    try {
      await fetch(this.API_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      this.updateStatusUI('saved');
    } catch (e) {
      console.error("Cloud push sync write failed:", e);
      this.updateStatusUI('error');
    }
  }
};