(async () => {
  const { h, render } = await import('https://esm.sh/preact');
  const { useState, useEffect } = await import('https://esm.sh/preact/hooks');
  
  const App = window.App = window.App || {};

  const Components = {};

  ({EstimatorTabs: Components.EstimatorTabs} = await import("./components/EstimatorTabs.js"));
  ({FilterGroup: Components.FilterGroup} = await import("./components/FilterGroup.js"));
  ({JobCard: Components.JobCard} = await import("./components/JobCard.js"));
  ({KanbanBoard: Components.KanbanBoard} = await import("./components/KanbanBoard.js"));
  ({Modal: Components.Modal} = await import("./components/Modal.js"));
  ({Sidebar: Components.Sidebar} = await import("./components/Sidebar.js"));
  ({SyncIndicator: Components.SyncIndicator} = await import("./components/SyncIndicator.js"));

  // --- 1. CONFIGURATION ---
  const CONFIG = {
    KEYS: {
      MANUAL: "manual_estimates_v8",
      OVERRIDE: "cms_overrides_v1",
    }
  };

  const { KanbanPhases } = await import("./modules/enums.js");
  const { formatDateForInput } = await import("./modules/libs.js");

  const { Estimate } = await import("./classes/Estimate.js");
  const { Scraper } = await import("./classes/Scraper.js");
  const { Store } = await import("./classes/Store.js");

  // --- 4. SCRAPER ENGINE ---
  const scraper = App.scraper = App.scraper || new Scraper({
    rowMapper: {
      "Job Number": cell => ({ jobNum: cell.textContent.trim(), url: cell.querySelector("a")?.href }),
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

  // --- 5. UI / VIEW LAYER ---
  const View = {
    render(activeEstimator = null) {
      if (document.querySelector(".modal-overlay")) {
        console.log("Render blocked: Modal is open.");
        return;
      }

      const list = [...Store.all.values()];
      const estimators = [...new Set(list.map(e => e.estimator))].sort();
      const divisions = [...new Set(list.map(e => e.division))].filter(Boolean).sort();

      // Default to "All" if no estimator is specified
      if (activeEstimator === null) activeEstimator = "All";

      let container = document.querySelector(".dash-container");

      if (!container) {
        // Initial full render if it doesn't exist
        document.body.innerHTML = `<style>${this._getStyles()}</style>`;
        container = document.createElement("div");
        container.className = "dash-container";
        document.body.appendChild(container);
      }

      const existingFilter = document.getElementById("division-filter");
      const previousSelections = existingFilter
        ? Array.from(existingFilter.selectedOptions).map(opt => opt.value)
        : null;

      const passesDivFilter = (job) => !previousSelections || previousSelections.includes(job.division);

      // Create the "All" tab + individual estimator tabs
      const tabsHtml = `
        <button class="tab-btn ${activeEstimator === 'All' ? 'active' : ''}" 
                onclick="window.App.switchTab('All')">All (${list.filter(e => e.isActive && passesDivFilter(e)).length})</button>
        ${estimators.map(est => `
            <button class="tab-btn ${est === activeEstimator ? 'active' : ''}" 
                    onclick="window.App.switchTab('${est}')">${est} (${list.filter(e => e.estimator === est && e.isActive && passesDivFilter(e)).length})</button>
        `).join('')}
      `;

      if (!container.innerHTML) {
        container.innerHTML = `
            <div class="tabs-bar">
                <div class="tabs">${tabsHtml}</div>
                <div style="display: flex; align-items: center;">
                  <div class="filter-group">
                      <label>Divisions:</label>
                      <select id="division-filter" class="multi-select-dropdown" multiple size="1">
                          ${divisions.map(div => {
          // If we have previousSelections, use them. Otherwise, default to all 'selected'.
          const isSelected = previousSelections
            ? previousSelections.includes(div)
            : true;
          return `<option value="${div}" ${isSelected ? 'selected' : ''}>${div}</option>`;
        }).join('')}
                      </select>
                  </div>              
                  <div style="display: flex; align-items: center;">
                      <div id="sync-status" class="sync-indicator"></div>
                      <button class="add-btn" onclick="window.App.openModal()">+ ADD SUPP/CO</button>
                  </div>
              </div>
            </div>
            <div class="main-content" id="board"></div>
        `;

        // Initial listener attachment
        document.getElementById('division-filter').addEventListener('change', () => {
          this.render(activeEstimator);
        });
      } else {
        // Partial Update: Just update the tabs and tab bar counts
        container.querySelector(".tabs").innerHTML = tabsHtml;
      }

      this._buildBoard(activeEstimator);
    },

    _buildBoard(estimator) {
      const board = document.getElementById("board");

      board.innerHTML = "";

      const selectedDivisions = Array.from(document.getElementById('division-filter').selectedOptions).map(opt => opt.value);

      const filtered = [...Store.all.values()].filter(e => {
        const estimatorMatch = (estimator === "All" ? true : e.estimator === estimator);
        const divisionMatch = selectedDivisions.includes(e.division);
        return estimatorMatch && divisionMatch;
      });

      const phaseDescriptions = {
        [Phases.Inspection]: "Default phase for all new jobs before an inspection date is entered.",
        [Phases.Estimate]: "Jobs that have been inspected but do not have an 'Estimate Sent' date yet.",
        [Phases.Review]: "Estimates that have been sent and have an Xactimate ID, but no 'Reviewed' date.",
        [Phases.Approval]: "Estimates sent/reviewed that are waiting for an 'Approved' date.",
        [Phases.Process]: "Jobs approved but awaiting processing (Total Estimates > $0).",
        [Phases.AssignPM]: "Structure jobs that are processed but do not have a Supervisor assigned. Adding an invoice date will bypass PM assignment."
      };

      // Define our groups for styling
      const phaseGroups = {
        [Phases.Inspection]: "group-pre-con",
        [Phases.Estimate]: "group-pre-con",
        [Phases.Review]: "group-pre-con",
        [Phases.Approval]: "group-pre-con",
        [Phases.Process]: "group-pre-con",
        [Phases.AssignPM]: "group-pm"
      }

      Object.keys(phaseGroups).forEach(p => {
        const col = document.createElement("div");

        // Determine which group class to apply
        const groupClass = phaseGroups[p];
        col.className = `phase-col ${groupClass}`;

        const description = phaseDescriptions[p] || "";
        col.innerHTML = `<h3 title="${description}" style="cursor:help;">${p.toUpperCase()}</h3><div class="card-list"></div>`;

        filtered.filter(e => e.phase === p && e.division !== "Warranty")
          .sort((a, b) => b.aging - a.aging)
          .forEach(est => col.querySelector(".card-list").appendChild(this._createCard(est)));

        board.appendChild(col);
      });

      board.appendChild(this._createSidebar(filtered));
    },

    _createCard(est) {
      const card = document.createElement("div");
      const severity = est.aging >= 10 ? 'danger' : (est.aging >= 5 ? 'warning' : 'normal');
      card.className = `job-card ${est.isManual ? 'manual' : ''} ${severity}`;
      card.innerHTML = `
                <div class="aging-tag">${est.aging}d</div>
                <div style="font-weight:bold; font-size:12px;"><a href="${est.url}" target="_blank" onclick="event.stopPropagation()">${est.jobNumber}</a></div>
                <div style="font-size:11px; color:#666;">${est.customer} - ${est.description}</div>
                <div class="badges">
                    ${est.xactId ? `<span class="badge badge-manual"><a href="https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${est.xactId}" target="_blank" onclick="event.stopPropagation()">XACT</a></span>` : ''}
                    ${est.isManual ? `<span class="badge badge-manual">${est.type}</span>` : ''}
                    ${est.tasks.needsContact ? '<span class="badge badge-urgent">CONTACT DUE</span>' : ''}
                    ${est.tasks.needsWorkAuth || est.tasks.needsSignedCO ? '<span class="badge badge-auth">NEED AUTH</span>' : ''}
                    
                </div>
            `;
      card.onclick = () => window.App.openModal(est.uniqueId);
      return card;
    },

    _createSidebar(jobs) {
      const sidebar = document.createElement("div");
      sidebar.className = "sidebar";
      const sections = [
        { t: "Contact Needed", f: j => j.tasks.needsContact, c: "#e74c3c" },
        { t: "Warranty Jobs", f: j => j.division === "Warranty", c: "#3498db" },
        { t: "Needs Work Auth", f: j => j.tasks.needsWorkAuth, c: "#8e44ad" },
        { t: "Needs Signed CO", f: j => j.tasks.needsSignedCO, c: "#8e44ad" },
        { t: "Enter Deductible", f: j => j.tasks.needsDeductible, c: "#d35400" }
      ];

      sections.forEach(sec => {
        const list = jobs.filter(sec.f);
        if (!list.length) return;
        const div = document.createElement("div");
        div.innerHTML = `<h4>${sec.t} (${list.length})</h4>`;
        list.forEach(j => {
          const item = document.createElement("div");
          item.className = "sidebar-item";
          item.style.borderLeft = `3px solid ${sec.c}`;
          item.innerHTML = `<b>${j.jobNumber}</b><br>${j.customer} - ${j.description}`;
          item.onclick = () => (j.isManual || sec.t.includes("Contact")) ? window.App.openModal(j.uniqueId) : window.open(j.url, "_blank");
          div.appendChild(item);
        });
        sidebar.appendChild(div);
      });
      return sidebar;
    },

    _getStyles() {
      return `
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
                .modal-overlay { 
                    position: fixed; 
                    top: 0; 
                    left: 0; 
                    width: 100%; 
                    height: 100%; 
                    background: rgba(0,0,0,0.7); 
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    z-index: 1000; 
                }

                .modal-box { 
                    background: white; 
                    padding: 20px; 
                    border-radius: 8px; 
                    width: 450px; 
                    max-height: 90vh; 
                    overflow-y: auto; 
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3); 
                }

                .modal-field { 
                    margin-bottom: 15px; 
                }

                .modal-field label { 
                    display: block; 
                    font-size: 11px; 
                    font-weight: bold; 
                    color: #7f8c8d; 
                    margin-bottom: 5px; 
                    text-transform: uppercase;
                }

                .modal-field input, 
                .modal-field select { 
                    width: 100%; 
                    padding: 8px; 
                    border: 1px solid #ddd; 
                    border-radius: 4px; 
                    box-sizing: border-box; 
                    font-family: inherit;
                }

                .modal-btns { 
                    display: flex; 
                    justify-content: flex-end; 
                    gap: 10px; 
                    margin-top: 20px; 
                    padding-top: 15px;
                    border-top: 1px solid #eee;
                }

              /* Button Variants */
              .btn-save { background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
              .btn-save:hover { background: #2980b9; }

              .btn-delete { background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }
              .btn-delete:hover { background: #c0392b; }

              .btn-cancel { background: #ecf0f1; color: #34495e; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
              .btn-cancel:hover { background: #bdc3c7; }

              .sync-indicator { 
                  display: inline-flex; 
                  align-items: center; 
                  margin-right: 15px; 
                  font-size: 14px; 
                  color: #95a5a6; 
              }
              .spinner {
                  width: 14px;
                  height: 14px;
                  border: 2px solid rgba(255,255,255,.3);
                  border-radius: 50%;
                  border-top-color: #fff;
                  animation: spin 1s ease-in-out infinite;
                  margin-right: 5px;
              }

              /* Group Styling */
              .phase-col.group-pre-con { background: #e3f2fd; border-top: 4px solid #2196f3; } /* Light Blue */
              .phase-col.group-pm { background: #f1f8e9; border-top: 4px solid #8bc34a; }      /* Light Green */

              .phase-col.group-pre-con h3 { color: #0d47a1; border-bottom-color: #bbdefb; }
              .phase-col.group-pm h3 { color: #33691e; border-bottom-color: #dcedc8; }

              .filter-group {
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  background: #34495e;
                  padding: 5px 10px;
                  border-radius: 4px;
                  margin-right: 15px;
              }
              .filter-group label {
                  color: #ecf0f1;
                  font-size: 11px;
                  font-weight: bold;
              }
              .multi-select-dropdown {
                  background: #fff;
                  border: 1px solid #ddd;
                  border-radius: 3px;
                  font-size: 11px;
                  padding: 2px;
                  min-width: 120px;
              }

              @keyframes spin { to { transform: rotate(360deg); } }
              .status-dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
              .status-online { background: #27ae60; }
              .status-offline { background: #e74c3c; }

              @media print {
                /* Hide the sidebar and navigation elements */
                .sidebar, .tabs-bar, .add-btn {
                    display: none !important;
                }
            
                /* Force the columns to stack vertically so none are cut off */
                .main-content {
                    display: block !important;
                    overflow: visible !important;
                    width: 100% !important;
                    padding: 0 !important;
                }
            
                /* Ensure each column takes up the full width of the paper */
                .phase-col {
                    margin-bottom: 30px !important;
                    background: white !important;
                }
            
                /* Adjust the card list to show all items */
                .card-list {
                    overflow: visible !important;
                    display: block !important;
                }
            
                /* Remove background colors to save ink and improve clarity */
                body {
                    background: white !important;
                    color: black !important;
                }
              }
            `;
    }
  };

  // --- 6. APP CONTROLLER ---
  window.App = {
    async init() {
      // 1. Standard event listeners
      window.addEventListener('beforeunload', (e) => {
        if (this.isSyncing) {
          e.preventDefault();
          e.returnValue = 'Data is still syncing...';
        }
      });

      const data = await Scraper.scrape();
      if (data) {
        window.estAccumulator = data || [];
        Store.rebuildLocal(window.estAccumulator);
        View.render("All");

        if (data) {
          Store.initialFetch(window.estAccumulator);
        }
      }
    },

    switchTab(est) { View.render(est); },

    openModal(id = null) {
      const isNew = !id;
      // 1. Reference the new Store and active tab logic
      const activeEstName = document.querySelector(".tab-btn.active")?.textContent.split(' (')[0] || "Unassigned";

      const est = Store.all.get(id) || {
        estimator: activeEstName,
        isManual: true,
        type: "SUPP",
        jobNumber: "", customer: "", url: "",
        received: "", inspected: "", sent: "", approved: "", workAuth: ""
      };

      const isCms = est.type === 'CMS';

      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
              <div class="modal-box">
                  <h3 style="margin-top:0">${isCms ? 'Log CMS Contact' : (isNew ? 'Add Supplement/CO' : 'Edit Local Entry')}</h3>
                  
                  <div class="modal-field"><label>Last Follow Up (Resets Aging)</label><input type="date" id="m-fol" value="${formatDateForInput(est.lastFollowUp) || ''}"></div>
                  <div class="modal-field"><label>Last Contact (Weekly Check)</label><input type="date" id="m-con" value="${formatDateForInput(est.lastContact) || ''}"></div>
                  <div class="modal-field"><label>Estimate Reviewed</label><input type="date" id="m-rev" value="${formatDateForInput(est.reviewed) || ''}"></div>
                  
                  ${!isCms ? `
                      <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
                      <div class="modal-field"><label>Job Slideboard URL (Auto-fills Job #)</label><input type="text" id="m-url" value="${est.url || ''}"></div>
                      <div class="modal-field"><label>Type</label>
                          <select id="m-type" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                              <option value="SUPP" ${est.type === 'SUPP' ? 'selected' : ''}>Supplement</option>
                              <option value="CO" ${est.type === 'CO' ? 'selected' : ''}>Change Order</option>
                          </select>
                      </div>
                      <div class="modal-field"><label>Job #</label><input type="text" id="m-job" value="${est.jobNumber}"></div>
                      <div class="modal-field"><label>Description</label><input type="text" id="m-desc" value="${est.description}"></div>
                      
                      <div class="modal-field"><label>Date Received</label><input type="date" id="m-rec" value="${formatDateForInput(est.received)}"></div>
                      <div class="modal-field"><label>Date Inspected</label><input type="date" id="m-ins" value="${formatDateForInput(est.inspected)}"></div>
                      <div class="modal-field"><label>Date Estimate Sent</label><input type="date" id="m-sen" value="${formatDateForInput(est.sent)}"></div>
                      <div class="modal-field"><label>Date Estimate Approved</label><input type="date" id="m-app" value="${formatDateForInput(est.approved)}"></div>
                      <div class="modal-field"><label>Date Signed/Auth (Clears Badge)</label><input type="date" id="m-auth" value="${formatDateForInput(est.workAuth) || ''}"></div>
                  ` : `<p style="font-size:12px; color:#666;">Editing CMS Job: <b>${est.jobNumber}</b></p>`}
                  
                  <div class="modal-btns" style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                      ${(!isNew && !isCms) ? '<button id="m-del" style="background:#e74c3c; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; margin-right:auto;">Delete</button>' : ''}
                      <button onclick="this.closest('.modal-overlay').remove()" style="background:#eee; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">Cancel</button>
                      <button id="m-sav" style="background:#3498db; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">Save</button>
                  </div>
              </div>
          `;
      document.body.appendChild(overlay);

      // URL Parsing Logic
      const urlInput = document.getElementById('m-url');
      const jobInput = document.getElementById('m-job');
      if (urlInput && jobInput) {
        urlInput.addEventListener('input', (e) => {
          const match = e.target.value.match(/[?&]JobNumber=([^&#]+)/);
          if (match && match[1]) jobInput.value = decodeURIComponent(match[1]);
        });
      }

      // 2. Updated Delete Logic using CONFIG and Store
      if (document.getElementById('m-del')) {
        document.getElementById('m-del').onclick = () => {
          let mans = Store.get(CONFIG.KEYS.MANUAL);

          // Soft delete: Find the item and mark it deleted
          mans = mans.map(m => {
            if (m.uniqueId === est.uniqueId) {
              return { ...m, deleted: true };
            }
            return m;
          });

          Store.save(CONFIG.KEYS.MANUAL, mans);
          overlay.remove();

          // Rebuild and Sync
          Store.rebuildLocal(window.estAccumulator || []);
          View.render(est.estimator);
          Store.syncRemote(window.estAccumulator || [], est.estimator);
        };
      }

      // 3. Updated Save Logic using CONFIG and Store
      document.getElementById('m-sav').onclick = () => {
        const fol = document.getElementById('m-fol').value;
        const con = document.getElementById('m-con').value;
        const rev = document.getElementById('m-rev').value;

        if (isCms) {
          const ov = Store.get(CONFIG.KEYS.OVERRIDE);
          ov[est.jobNumber] = { lastFollowUp: fol, lastContact: con, reviewed: rev };
          Store.save(CONFIG.KEYS.OVERRIDE, ov);
        } else {
          let mans = Store.get(CONFIG.KEYS.MANUAL);
          const updatedData = {
            ...est,
            lastFollowUp: fol,
            lastContact: con,
            type: document.getElementById('m-type').value,
            jobNumber: document.getElementById('m-job').value,
            description: document.getElementById('m-desc').value,
            received: document.getElementById('m-rec').value,
            inspected: document.getElementById('m-ins').value,
            sent: document.getElementById('m-sen').value,
            approved: document.getElementById('m-app').value,
            workAuth: document.getElementById('m-auth').value,
            url: document.getElementById('m-url').value,
            reviewed: document.getElementById('m-rev').value,
            uniqueId: est.uniqueId || Date.now().toString(),
            isManual: true
          };

          if (isNew) mans.push(updatedData);
          else mans = mans.map(m => m.uniqueId === est.uniqueId ? updatedData : m);

          Store.save(CONFIG.KEYS.MANUAL, mans);
        }

        // --- RE-RENDER LOGIC ---
        // 1. Remove the modal overlay
        overlay.remove();

        // 2. Re-sync the store with the new local data
        // We pass window.estAccumulator which holds the current scraped data
        Store.sync(window.estAccumulator || []);

        Store.rebuildLocal(window.estAccumulator || []);

        // Trigger Render
        const activeTab = document.querySelector(".tab-btn.active")?.textContent.split(' (')[0] || "All";
        View.render(activeTab);

        Store.push();
      };
    }
  };

  window.App.init();
})();
