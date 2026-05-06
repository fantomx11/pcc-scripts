export const Store = {
  all: new Map(),
  isSyncing: false,
  API_URL: "https://script.google.com/macros/s/AKfycbyU3a4YSvJ8CMWNDXUHvyCT2wKrokmIQ60NAl9VIS-9RIB3y6lhsXlyPHCK5bKVNSIg/exec",
  _syncTimeout: null,

  get(key) { return JSON.parse(localStorage.getItem(key) || (key.includes('overrides') ? "{}" : "[]")); },
  save(key, data) { localStorage.setItem(key, JSON.stringify(data)); },

  rebuildLocal(scrapedData) {
    const manuals = this.get(CONFIG.KEYS.MANUAL);
    const overrides = this.get(CONFIG.KEYS.OVERRIDE);
    this.all.clear();

    manuals.forEach(m => this.all.set(m.uniqueId, new Estimate(m)));
    scrapedData.forEach(s => {
      const extra = overrides[s.jobNumber] || {};
      const est = new Estimate({ ...s, ...extra });
      this.all.set(est.uniqueId, est);
    });
  },

  async syncRemote(scrapedData, activeEstimator) {
    if (this._syncTimeout) clearTimeout(this._syncTimeout);

    this.updateStatusUI('syncing');

    this._syncTimeout = setTimeout(async () => {
      try {
        const payload = {
          manual: this.get(CONFIG.KEYS.MANUAL),
          overrides: this.get(CONFIG.KEYS.OVERRIDE)
        };

        const resp = await fetch(this.API_URL, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        const cloudData = await resp.json();

        // Update local storage with any potential merges from cloud
        if (cloudData.manual) this.save(CONFIG.KEYS.MANUAL, cloudData.manual);
        if (cloudData.overrides) this.save(CONFIG.KEYS.OVERRIDE, cloudData.overrides);

        // Final rebuild and re-render to ensure UI matches Cloud reality
        this.rebuildLocal(scrapedData);
        View.render(activeEstimator);
        this.updateStatusUI('saved');
      } catch (e) {
        console.error(e);
        this.updateStatusUI('error');
      }
    }, 2000); // 2-second debounce
  },

  // Inside Store object
  async initialFetch(scrapedData) {
    this.updateStatusUI('syncing');
    try {
      const resp = await fetch(this.API_URL);
      const cloudData = await resp.json();

      // Update LocalStorage with fresh cloud data
      if (cloudData.manual) this.save(CONFIG.KEYS.MANUAL, cloudData.manual);
      if (cloudData.overrides) this.save(CONFIG.KEYS.OVERRIDE, cloudData.overrides);

      // Rebuild the Map and trigger the "Background Sync Complete" render
      this.rebuildLocal(scrapedData);

      // Optional: Only re-render if the user is on the 'All' tab 
      // or keep it simple and just re-render current view
      const activeTab = document.querySelector(".tab-btn.active")?.textContent.split(' (')[0] || "All";
      View.render(activeTab);

      this.updateStatusUI('saved');
    } catch (e) {
      console.error("Initial sync failed:", e);
      this.updateStatusUI('error');
    }
  },

  async sync(scrapedData) {
    this.updateStatusUI('syncing');
    try {
      const resp = await fetch(this.API_URL);
      const cloudData = await resp.json();

      if (cloudData.manual) this.save(CONFIG.KEYS.MANUAL, cloudData.manual);
      if (cloudData.overrides) this.save(CONFIG.KEYS.OVERRIDE, cloudData.overrides);
      this.updateStatusUI('saved');
    } catch (e) {
      console.log(e);
      this.updateStatusUI('error');
    }

    // Rebuild the internal Map
    const manuals = this.get(CONFIG.KEYS.MANUAL);
    const overrides = this.get(CONFIG.KEYS.OVERRIDE);
    this.all.clear();
    manuals.forEach(m => this.all.set(m.uniqueId, new Estimate(m)));
    scrapedData.forEach(s => {
      const extra = overrides[s.jobNumber] || {};
      const est = new Estimate({ ...s, ...extra });
      this.all.set(est.uniqueId, est);
    });
  },

  updateStatusUI(status) {
    const container = document.getElementById("sync-status");
    if (!container) return;

    if (status === 'syncing') {
      container.innerHTML = `<div class="spinner"></div> <span style="font-size:10px; color:white;">SYNCING...</span>`;
      this.isSyncing = true;
    } else if (status === 'error') {
      container.innerHTML = `<div class="status-dot status-offline"></div> <span style="font-size:10px; color:#e74c3c;">SYNC ERROR</span>`;
      this.isSyncing = false;
    } else {
      container.innerHTML = `<div class="status-dot status-online"></div> <span style="font-size:10px; color:#95a5a6;">CLOUD SAVED</span>`;
      this.isSyncing = false;
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
      debugger;
      console.log(e);
      this.updateStatusUI('error');
    }
  }
};
