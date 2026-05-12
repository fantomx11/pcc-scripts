(async () => {
  const devMode = false;

  const baseUrl = devMode ? "https://cdn.statically.io/gh/fantomx11/pcc-scripts@dev" : "https://fantomx11.github.io/pcc-scripts";
  
  const { h, render } = await import('https://esm.sh/preact');
  const { useState, useEffect } = await import('https://esm.sh/preact/hooks');

  const App = window.App = window.App || {};

  const Components = {};

  ({ EstimatorTabs: Components.EstimatorTabs } = await import(`${baseUrl}/components/EstimatorTabs.js`));
  ({ FilterGroup: Components.FilterGroup } = await import(`${baseUrl}/components/FilterGroup.js`));
  ({ JobCard: Components.JobCard } = await import(`${baseUrl}/components/JobCard.js`));
  ({ KanbanBoard: Components.KanbanBoard } = await import(`${baseUrl}/components/KanbanBoard.js`));
  ({ Modal: Components.Modal } = await import(`${baseUrl}/components/Modal.js`));
  ({ Sidebar: Components.Sidebar } = await import(`${baseUrl}/components/Sidebar.js`));
  ({ SyncIndicator: Components.SyncIndicator } = await import(`${baseUrl}/components/SyncIndicator.js`));

  // --- 1. CONFIGURATION ---
  const CONFIG = {
    KEYS: {
      MANUAL: "manual_estimates_v8",
      OVERRIDE: "cms_overrides_v1",
    }
  };

  const { KanbanPhases } = await import(`${baseUrl}/modules/enums.js`);
  const { html, formatDateForInput } = await import(`${baseUrl}/modules/lib.js`);

  const { Estimate } = await import(`${baseUrl}/classes/Estimate.js`);
  const { Scraper } = await import(`${baseUrl}/classes/Scraper.js`);
  const { Store } = await import(`${baseUrl}/classes/Store.js`);

  // --- 4. SCRAPER ENGINE ---
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
    const [editingId, setEditingId] = useState(null);

    const allDivisions = [...new Set(estimates.map(e => e.division))].filter(Boolean).sort();
    const [selectedDivs, setSelectedDivs] = useState(allDivisions);

    const openModal = (id = null) => setEditingId(id || 'new-' + Date.now());

    useEffect(() => {
      window.App.openModal = (id = null) => {
        console.log("Opening modal for:", id);
        setEditingId(id || `new-${Date.now()}`);
      };
    }, []);

    const handleSave = (formData) => {
      // 1. Determine if it's a CMS override or a Manual entry
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
        else mans.push(formData);

        Store.save(CONFIG.KEYS.MANUAL, mans);
      }

      Store.rebuildLocal(App.scraper.results, Estimate);
      
      // 2. Update local state to trigger Preact re-render
      setEstimates(Array.from(Store.all.values()));
      setEditingId(null);

      // 3. Trigger background sync
      Store.push();
    };

    const handleDelete = (id) => {
      if (confirm("Delete this local entry?")) {
        let mans = Store.get(CONFIG.KEYS.MANUAL);
        // Soft delete logic from your original script
        mans = mans.map(m => m.uniqueId === id ? { ...m, deleted: true } : m);
        Store.save(CONFIG.KEYS.MANUAL, mans);

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

    const estimators = [...new Set(estimates.map(e => e.estimator))].sort();

    return html`
      <div>
        <div class="dash-container">
          <style>${ViewStyles}</style>
          <div class="tabs-bar">
            <${Components.EstimatorTabs} 
              estimates=${estimates} 
              activeTab=${activeTab} 
              selectedDivs=${selectedDivs} 
              onTabChange=${setActiveTab} 
            />
            <div style="display: flex; align-items: center;">
              <${Components.FilterGroup} 
                divisions=${allDivisions} 
                onFilterChange=${(selected) => setSelectedDivs(selected)} 
              />          
              <${Components.SyncIndicator} status=${syncStatus} />
              <button class="add-btn" onClick=${() => window.App.openModal()}>+ ADD SUPP/CO</button>
            </div>
          </div>
          <div class="main-content">
            <${Components.KanbanBoard} 
              estimates=${estimates} 
              activeEstimator=${activeTab} 
              selectedDivs=${selectedDivs} 
            />
            <${Components.Sidebar} 
              jobs=${estimates} 
              activeEstimator=${activeTab} 
              selectedDivs=${selectedDivs} 
            />
          </div>
        </div>

        ${editingId ? html`
          <${Components.Modal} 
            estimate=${currentEstimate} 
            onClose=${() => setEditingId(null)} 
            onSave=${handleSave}
            onDelete=${handleDelete}
          />
        ` : ''}
      </div>
    `;
  };

  // --- 6. APP CONTROLLER ---
  App.init = async function init() {
    const scrapedData = scraper.scrape(); // Use your existing Scraper object
    if (scrapedData) {
      window.addEventListener('beforeunload', (e) => {
        if (this.isSyncing) {
          e.preventDefault();
          e.returnValue = 'Data is still syncing...';
        }
      });

      App.store = Store;

      Store.rebuildLocal(scrapedData, Estimate); // Use your existing Store object
      const root = document.body;
      root.innerHTML = ''; // Clear for fresh React mount
      render(html`<${Components.App} initialEstimates=${Array.from(Store.all.values())} />`, root);
    }
  };

  const ViewStyles = `
    .dash-container { display: flex; flex-direction: column; height: 100vh; font-family: 'Segoe UI', sans-serif; }
    .tabs-bar { display: flex; background: #2c3e50; padding: 0 15px; justify-content: space-between; align-items: center; min-height: 45px; }
    .tab-btn { padding: 10px 15px; background: none; border: none; color: #95a5a6; cursor: pointer; border-bottom: 3px solid transparent; }
    .tab-btn.active { color: white; border-bottom-color: #3498db; font-weight: bold; }
    .main-content { display: flex; flex: 1; overflow: hidden; padding: 15px; gap: 15px; }
    .phase-col { flex: 1; display: flex; flex-direction: column; background: #ebedef; border-radius: 6px; padding: 10px; min-width: 200px; }
    .job-card { background: white; padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 5px solid #bdc3c7; position: relative; cursor: pointer; }
    body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; }
    .dash-container { display: flex; flex-direction: column; height: 100vh; }
    .tabs-bar { display: flex; background: #2c3e50; padding: 0 15px; justify-content: space-between; align-items: center; min-height: 45px; }
    .tab-btn { padding: 10px 15px; background: none; border: none; color: #95a5a6; cursor: pointer; border-bottom: 3px solid transparent; }
    .tab-btn.active { color: white; border-bottom-color: #3498db; font-weight: bold; }
    .main-content { display: flex; flex: 1; overflow: hidden; padding: 15px; gap: 15px; }
    .phase-col { flex: 1; display: flex; flex-direction: column; background: #ebedef; border-radius: 6px; padding: 10px; }
    .phase-col h3 { font-size: 11px; text-align: center; color: #7f8c8d; margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
    .card-list { flex: 1; overflow-y: auto; }
    .job-card { background: white; padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 5px solid #bdc3c7; position: relative; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .job-card.warning { border-left-color: #f39c12; }
    .job-card.danger { border-left-color: #e74c3c; }
    .aging-tag { position: absolute; top: 8px; right: 8px; font-size: 10px; font-weight: bold; color: #95a5a6; }
    .badge { display: inline-block; font-size: 9px; padding: 2px 5px; border-radius: 3px; color: white; margin-top: 5px; margin-right: 3px; font-weight: bold; }
    .badge a { color: inherit; text-decoration: none; }
    .badge-urgent { background: #e74c3c; }
    .badge-auth { background: #8e44ad; }
    .badge-manual { background: #f39c12; }
    .sidebar { width: 250px; background: #fff; border-left: 1px solid #ddd; padding: 10px; overflow-y: auto; }
    .sidebar h4 { font-size: 10px; text-transform: uppercase; color: #3498db; border-bottom: 2px solid #3498db; margin: 15px 0 8px 0; }
    .sidebar-item { font-size: 11px; padding: 6px; border: 1px solid #eee; margin-bottom: 5px; cursor: pointer; }
    .add-btn { background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer; }
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-box { background: white; padding: 20px; border-radius: 8px; width: 450px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .modal-field { margin-bottom: 15px; }
    .modal-field label { display: block; font-size: 11px; font-weight: bold; color: #7f8c8d; margin-bottom: 5px; text-transform: uppercase;}
    .modal-field input, .modal-field select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-family: inherit;}
    .modal-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; padding-top: 15px;border-top: 1px solid #eee;}

    /* Button Variants */
    .btn-save { background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    .btn-save:hover { background: #2980b9; }
    .btn-delete { background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
    .btn-delete:hover { background: #c0392b; }
    .btn-cancel { background: #ecf0f1; color: #34495e; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
    .btn-cancel:hover { background: #bdc3c7; }

    .sync-indicator { display: inline-flex; align-items: center; margin-right: 15px; font-size: 14px; color: #95a5a6; }
    .spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s ease-in-out infinite; margin-right: 5px; }

    /* Group Styling */
    .phase-col.group-pre-con { background: #e3f2fd; border-top: 4px solid #2196f3; } /* Light Blue */
    .phase-col.group-pm { background: #f1f8e9; border-top: 4px solid #8bc34a; }      /* Light Green */
    .phase-col.group-pre-con h3 { color: #0d47a1; border-bottom-color: #bbdefb; }
    .phase-col.group-pm h3 { color: #33691e; border-bottom-color: #dcedc8; }

    .filter-group { display: flex; align-items: center; gap: 8px; background: #34495e; padding: 5px 10px; border-radius: 4px; margin-right: 15px; }
    .filter-group label { color: #ecf0f1; font-size: 11px; font-weight: bold; }
    .multi-select-dropdown { background: #fff; border: 1px solid #ddd; border-radius: 3px; font-size: 11px; padding: 2px; min-width: 120px; }

    @keyframes spin { to { transform: rotate(360deg); } }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .status-online { background: #27ae60; }
    .status-offline { background: #e74c3c; }

    @media print {
      .sidebar, .tabs-bar, .add-btn { display: none !important; }
      .main-content { display: block !important; overflow: visible !important; width: 100% !important; padding: 0 !important; }
      .phase-col { margin-bottom: 30px !important; background: white !important; }
      .card-list { overflow: visible !important; display: block !important; }
      body { background: white !important; color: black !important; }
    }
  `;

  App.init();
})();
