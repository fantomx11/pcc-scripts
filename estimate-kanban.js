(async () => {
  const devMode = false;

  const baseUrl = devMode ? "https://cdn.statically.io/gh/fantomx11/pcc-scripts@dev" : "https://fantomx11.github.io/pcc-scripts";

  const { render } = await import('https://esm.sh/preact');
  const { useState, useEffect } = await import('https://esm.sh/preact/hooks');
  const { html } = await import(`${baseUrl}/modules/lib.js`);
  const { Estimate } = await import(`${baseUrl}/classes/Estimate.js`);
  const { Scraper } = await import(`${baseUrl}/classes/Scraper.js`);
  const { Store } = await import(`${baseUrl}/classes/Store.js`);

  const App = window.App = window.App || {};

  async function importComponents() {
    const [
      { EstimatorTabs },
      { FilterGroup },
      { JobCard },
      { KanbanBoard },
      { Modal },
      { Sidebar },
      { SyncIndicator }
    ] = await Promise.all([
      import(`${baseUrl}/components/EstimatorTabs.js`),
      import(`${baseUrl}/components/FilterGroup.js`),
      import(`${baseUrl}/components/JobCard.js`),
      import(`${baseUrl}/components/KanbanBoard.js`),
      import(`${baseUrl}/components/Modal.js`),
      import(`${baseUrl}/components/Sidebar.js`),
      import(`${baseUrl}/components/SyncIndicator.js`)
    ]);

    return {
      EstimatorTabs,
      FilterGroup,
      JobCard,
      KanbanBoard,
      Modal,
      Sidebar,
      SyncIndicator
    };
  }

  const Components = await importComponents();

  const CONFIG = {
    KEYS: {
      MANUAL: "manual_estimates_v8",
      OVERRIDE: "cms_overrides_v1",
    }
  };

  const scraper = App.scraper = App.scraper || new Scraper({
    rowMapper: {
      "Job Number": cell => ({ jobNumber: cell.textContent.trim(), url: cell.querySelector("a")?.href }),
      "Estimator": cell => ({ "estimator": cell.textContent.trim() || "Unassigned" }),
      "Date Received": cell => ({ "received": cell.textContent.trim() }),
      "Date Inspected": cell => ({ "inspected": cell.textContent.trim() }),
      "Date Estimate Sent": cell => ({ "sent": cell.textContent.trim() }),
      "Date Estimate Approved": cell => ({ "approved": cell.textContent.trim() }),
      "Date of Work Authorization": cell => ({ "workAuth": cell.textContent.trim() }),
      "Deductible Amount": cell => ({ "deductible": cell.textContent.trim() }),
      "Original Estimate": cell => ({ "origEstimate": cell.textContent.trim() }),
      "Xact TransactionID": cell => ({ "xactId": cell.textContent.trim() }),
      "Date Invoiced": cell => ({ "invoiced": cell.textContent.trim() })
    }
  });

  Components.App = ({ initialEstimates }) => {
    const [estimates, setEstimates] = useState(initialEstimates);
    const [activeTab, setActiveTab] = useState("All");
    const [syncStatus, setSyncStatus] = useState("saved");
    const [complianceTasks, setComplianceTasks] = useState(null);
    const [editingId, setEditingId] = useState(null);

    const allDivisions = [...new Set(estimates.map(e => e.division))].filter(Boolean).sort();
    const [selectedDivs, setSelectedDivs] = useState(allDivisions);

    useEffect(() => {
      Store.statusListener = (status) => setSyncStatus(status);
      Store.onCacheRebuilt = (updatedEstimates) => setEstimates(updatedEstimates);

      Store.initialFetch(App.scraper.results, Estimate);

      import(`${baseUrl}/modules/compliance.js`).then(async (mod) => {
        const tasks = await mod.fetchComplianceTasks();
        setComplianceTasks(tasks); // Pushes fresh metrics directly to UI sub-trees reactively
      });

      return () => { 
        Store.statusListener = null; 
        Store.onCacheRebuilt = null;
      };
    }, []);  

    useEffect(() => {
      window.App.openModal = (id = null) => {
        console.log("Opening modal for:", id);
        setEditingId(id || `new-${Date.now()}`);
      };
    }, []);

    const handleSave = (formData) => {
      const isCms = formData.uniqueId.startsWith('cms-');

      if (isCms) {
        const ov = Store.get(CONFIG.KEYS.OVERRIDE);
        ov[formData.jobNumber] = {
          lastFollowUp: formData.lastFollowUp,
          lastContact: formData.lastContact,
          reviewed: formData.reviewed
        };
        Store.save(CONFIG.KEYS.OVERRIDE, ov);
      } else {
        let mans = Store.get(CONFIG.KEYS.MANUAL);
        const updated = new Estimate(formData);
        const index = mans.findIndex(m => m.uniqueId === formData.uniqueId);

        if (index > -1) mans[index] = formData;
        else {
          formData.uniqueId = "cust-" + Date.now();
          mans.push(formData);
        }

        Store.save(CONFIG.KEYS.MANUAL, mans);
      }

      Store.rebuildLocal(App.scraper.results, Estimate);

      setEstimates(Array.from(Store.all.values()));
      setEditingId(null);

      Store.push();
    };

    const handleDelete = (id) => {
      if (confirm("Delete this local entry?")) {
        let mans = Store.get(CONFIG.KEYS.MANUAL);
        mans = mans.map(m => m.uniqueId === id ? { ...m, deleted: true } : m);
        Store.save(CONFIG.KEYS.MANUAL, mans);

        Store.rebuildLocal(App.scraper.results, Estimate);

        setEstimates(Array.from(Store.all.values()));
        setEditingId(null);
        Store.push();
      }
    };

    const currentEstimate = estimates.find(e => e.uniqueId === editingId) || {
      uniqueId: editingId, isManual: true, type: 'SUPP', estimator: activeTab !== 'All' ? activeTab : 'Unassigned'
    };

    useEffect(() => {
      Store.statusListener = (status) => setSyncStatus(status);

      // Optional: Clean up when the app closes
      return () => { Store.statusListener = null; };
    }, []);

    return html`
      <div>
        <link rel="stylesheet" href="${baseUrl}/styles/estimate-kanban.css" />
        <div class="dash-container">
          <div class="tabs-bar">
            <${Components.EstimatorTabs} estimates=${estimates} activeTab=${activeTab} selectedDivs=${selectedDivs} onTabChange=${setActiveTab} />
            <div style="display: flex; align-items: center;">
              ${complianceTasks === null ? html`
                <div style="display: inline-flex; align-items: center; margin-right: 15px;">
                  <div class="spinner"></div>
                  <span style="font-size: 10px; color: #e67e22; font-weight: bold; margin-left: 5px; text-transform: uppercase;">
                    Loading Compliance...
                  </span>
                </div>
              ` : html`
                <span style="font-size: 10px; color: #27ae60; margin-right: 15px; font-weight: bold;">
                  ${complianceTasks.length} COMPLIANCE TASKS LOADED
                </span>
              `}
              <${Components.FilterGroup} divisions=${allDivisions} onFilterChange=${(selected) => setSelectedDivs(selected)} />          
              <${Components.SyncIndicator} status=${syncStatus} />
              <button class="add-btn" onClick=${() => window.App.openModal()}>+ ADD SUPP/CO</button>
            </div>
          </div>
          <div class="main-content">
            <${Components.KanbanBoard} estimates=${estimates} activeEstimator=${activeTab} selectedDivs=${selectedDivs} />
            <${Components.Sidebar} jobs=${estimates} activeEstimator=${activeTab} selectedDivs=${selectedDivs} complianceTasks=${complianceTasks} />
          </div>
        </div>

        ${editingId ? html`
          <${Components.Modal} estimate=${currentEstimate} onClose=${() => setEditingId(null)} onSave=${handleSave} onDelete=${handleDelete} />
        ` : ''}
      </div>
    `;
  };

  App.init = async function init() {
    // Simply await the scraper promise. It will handle clicking, waiting, and collecting.
    const scrapedData = await scraper.scrape();

    if (scrapedData) {
      window.addEventListener('beforeunload', (e) => {
        if (Store.isSyncing) {
          e.preventDefault();
          e.returnValue = 'Data is still syncing...';
        }
      });

      App.store = Store;

      Store.rebuildLocal(scrapedData, Estimate);
      const root = document.body;
      root.innerHTML = ''; // Clear for fresh React mount

      render(html`<${Components.App} initialEstimates=${Array.from(Store.all.values())} />`, root);
    }
  };

  App.init();
})();