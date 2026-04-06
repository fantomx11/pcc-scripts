(() => {
    // --- 1. CONFIGURATION ---
    const CONFIG = {
        KEYS: { MANUAL: "manual_estimates_v8", OVERRIDE: "cms_overrides_v1" },
        SELECTORS: {
            HEADER: ".rgHeaderWrapper thead tr",
            ROWS: "tr.rgRow, tr.rgAltRow",
            PAGER: ".rgNumPart .rgCurrentPage"
        }
    };

    // --- 2. THE MODEL (Business Logic) ---
    class Estimate {
        constructor(data) {
            // Identification & Core Info
            this.uniqueId = data.uniqueId || `cms-${data.jobNumber}`;
            this.jobNumber = data.jobNumber;
            this.customer = data.customer;
            this.estimator = data.estimator || "Unassigned";
            this.division = data.division;
            this.type = data.type || 'CMS'; 
            this.url = data.url || "#";
            this.isManual = !!data.isManual;
            this.xactId = data.xactId;

            // Dates
            this.received = data.received;
            this.inspected = data.inspected;
            this.sent = data.sent;
            this.approved = data.approved;
            this.workAuth = data.workAuth;
            this.lastFollowUp = data.lastFollowUp || "";
            this.lastContact = data.lastContact || "";

            // Financials
            this.origEstimate = this._parseCurrency(data.origEstimate);
            this.deductible = this._parseCurrency(data.deductible);
        }

        _parseCurrency(val) {
            if (!val) return 0;
            return parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
        }

        _getDaysSince(dateStr) {
            if (!dateStr || String(dateStr).toLowerCase().includes("null") || dateStr === "") return 0;
            const diff = Math.floor((new Date() - new Date(dateStr)) / 864e5);
            return isNaN(diff) || diff < 0 ? 0 : diff;
        }

        get phase() {
            const hasDate = (d) => d && d !== "" && !String(d).toLowerCase().includes("null");
            if (this.division === "Warranty") return "Warranty";
            if (hasDate(this.approved)) return "Process";
            if (hasDate(this.sent)) return "Approval";
            if (hasDate(this.inspected)) return "Estimate";
            return "Inspection";
        }

        get aging() {
            const hasDate = (d) => d && d !== "" && !String(d).toLowerCase().includes("null");
            const refDate = (this.phase === "Approval" && hasDate(this.lastFollowUp)) 
                ? this.lastFollowUp 
                : (this.phase === "Process" ? this.approved : 
                  (this.phase === "Estimate" ? this.inspected : this.received));
            return this._getDaysSince(refDate);
        }

        get tasks() {
            const effectiveContact = this.lastContact || this.inspected || this.received;
            return {
                needsContact: this.phase === "Approval" && this._getDaysSince(effectiveContact) > 7,
                needsSignedCO: this.type === "CO" && !this.workAuth,
                needsWorkAuth: this.type === "CMS" && !this.workAuth && this.division !== "Warranty",
                needsDeductible: this.type === "CMS" && this.division === "Structure" && this.deductible === 0
            };
        }
    }

    // --- 3. STORAGE LAYER ---
    const Store = {
        all: new Map(),
        get(key) { return JSON.parse(localStorage.getItem(key) || (key.includes('overrides') ? "{}" : "[]")); },
        save(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
        sync(scrapedData) {
            const manuals = this.get(CONFIG.KEYS.MANUAL);
            const overrides = this.get(CONFIG.KEYS.OVERRIDE);
            this.all.clear();
            manuals.forEach(m => this.all.set(m.uniqueId, new Estimate(m)));
            scrapedData.forEach(s => {
                const extra = overrides[s.jobNumber] || {};
                const est = new Estimate({ ...s, ...extra });
                this.all.set(est.uniqueId, est);
            });
        }
    };

    // --- 4. SCRAPER ENGINE ---
    const Scraper = {
        async scrape() {
            const headerRow = document.querySelector(CONFIG.SELECTORS.HEADER);
            if (!headerRow) return [];
            const cells = [...headerRow.querySelectorAll("th")].map(c => c.textContent.trim().toLowerCase());
            const find = (txt) => cells.indexOf(txt.toLowerCase());
            const COL = { jobNum: find("Job Number"), customer: find("Customer"), estimator: find("Estimator"), 
                          received: find("Date Received"), inspected: find("Date Inspected"), sent: find("Date Estimate Sent"),
                          approved: find("Date Estimate Approved"), workAuth: find("Date of Work Authorization"),
                          deductible: find("Deductible Amount"), division: find("Division"), origEstimate: find("Original Estimate"),
                          xactId: find("Xact TransactionID")};

            const data = [...document.querySelectorAll(CONFIG.SELECTORS.ROWS)].map(row => {
                const c = row.querySelectorAll("td");
                return {
                    jobNumber: c[COL.jobNum]?.textContent.trim(),
                    customer: c[COL.customer]?.textContent.trim(),
                    estimator: c[COL.estimator]?.textContent.trim() || "Unassigned",
                    received: c[COL.received]?.textContent.trim(),
                    inspected: c[COL.inspected]?.textContent.trim(),
                    sent: c[COL.sent]?.textContent.trim(),
                    approved: c[COL.approved]?.textContent.trim(),
                    workAuth: c[COL.workAuth]?.textContent.trim(),
                    deductible: c[COL.deductible]?.textContent.trim(),
                    division: c[COL.division]?.textContent.trim(),
                    origEstimate: c[COL.origEstimate]?.textContent.trim(),
                    url: c[COL.jobNum]?.querySelector("a")?.href || "#",
                    xactId: c[COL.xactId]?.textContent.trim()
                };
            }).filter(j => j.jobNumber);

            window.estAccumulator = (window.estAccumulator || []).concat(data);
            const nextBtn = document.querySelector(CONFIG.SELECTORS.PAGER)?.nextElementSibling;
            if (nextBtn && nextBtn.tagName === "A") { nextBtn.click(); return null; }
            return window.estAccumulator;
        }
    };

    // --- 5. UI / VIEW LAYER ---
    const View = {
        render(activeEstimator = null) {
            const list = [...Store.all.values()];
            const estimators = [...new Set(list.map(e => e.estimator))].sort();
            activeEstimator = activeEstimator || (estimators.length ? estimators[0] : null);

            document.body.innerHTML = `<style>${this._getStyles()}</style>`;
            const container = document.createElement("div");
            container.className = "dash-container";
            container.innerHTML = `
                <div class="tabs-bar">
                    <div class="tabs">${estimators.map(est => `
                        <button class="tab-btn ${est === activeEstimator ? 'active' : ''}" 
                                onclick="window.App.switchTab('${est}')">${est} (${list.filter(e=>e.estimator===est).length})</button>
                    `).join('')}</div>
                    <button class="add-btn" onclick="window.App.openModal()">+ ADD SUPP/CO</button>
                </div>
                <div class="main-content" id="board"></div>
            `;
            document.body.appendChild(container);
            if (activeEstimator) this._buildBoard(activeEstimator);
        },

        _buildBoard(estimator) {
            const board = document.getElementById("board");
            const filtered = [...Store.all.values()].filter(e => e.estimator === estimator);
            
            // 1. Kanban Columns
            ["Inspection", "Estimate", "Approval", "Process"].forEach(p => {
                const col = document.createElement("div");
                col.className = "phase-col";
                col.innerHTML = `<h3>${p.toUpperCase()}</h3><div class="card-list"></div>`;
                filtered.filter(e => e.phase === p && e.division !== "Warranty")
                    .sort((a, b) => b.aging - a.aging)
                    .forEach(est => col.querySelector(".card-list").appendChild(this._createCard(est)));
                board.appendChild(col);
            });

            // 2. Sidebar
            board.appendChild(this._createSidebar(filtered));
        },

        _createCard(est) {
            const card = document.createElement("div");
            const severity = est.aging >= 10 ? 'danger' : (est.aging >= 5 ? 'warning' : 'normal');
            card.className = `job-card ${est.isManual ? 'manual' : ''} ${severity}`;
            card.innerHTML = `
                <div class="aging-tag">${est.aging}d</div>
                <div style="font-weight:bold; font-size:12px;"><a href="${est.url}" target="_blank" onclick="event.stopPropagation()">${est.jobNumber}</a></div>
                <div style="font-size:11px; color:#666;">${est.customer}</div>
                <div class="badges">
                    ${est.xactId ? `<span class="badge badge-manual"><a href="https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${est.xactId}" target="_blank" onclick="event.stopPropagation()">XACT</a></span>`: ''}
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
                    item.innerHTML = `<b>${j.jobNumber}</b><br>${j.customer}`;
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
            `;
        }
    };

    // --- 6. APP CONTROLLER ---
    window.App = {
        async init() {
            const data = await Scraper.scrape();
            if (data) { Store.sync(data); View.render(); }
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
                  
                  <div class="modal-field"><label>Last Follow Up (Resets Aging)</label><input type="date" id="m-fol" value="${est.lastFollowUp || ''}"></div>
                  <div class="modal-field"><label>Last Contact (Weekly Check)</label><input type="date" id="m-con" value="${est.lastContact || ''}"></div>
                  
                  ${!isCms ? `
                      <hr style="border:0; border-top:1px solid #eee; margin:15px 0;">
                      <div class="modal-field"><label>Job Slideboard URL (Auto-fills Job #)</label><input type="text" id="m-url" value="${est.url || ''}"></div>
                      <div class="modal-field"><label>Type</label>
                          <select id="m-type" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
                              <option value="SUPP" ${est.type==='SUPP'?'selected':''}>Supplement</option>
                              <option value="CO" ${est.type==='CO'?'selected':''}>Change Order</option>
                          </select>
                      </div>
                      <div class="modal-field"><label>Job #</label><input type="text" id="m-job" value="${est.jobNumber}"></div>
                      <div class="modal-field"><label>Customer</label><input type="text" id="m-cust" value="${est.customer}"></div>
                      <div class="modal-field"><label>Estimator</label><input type="text" id="m-est" value="${est.estimator}"></div>
                      
                      <div class="modal-field"><label>Date Received</label><input type="date" id="m-rec" value="${est.received}"></div>
                      <div class="modal-field"><label>Date Inspected</label><input type="date" id="m-ins" value="${est.inspected}"></div>
                      <div class="modal-field"><label>Date Estimate Sent</label><input type="date" id="m-sen" value="${est.sent}"></div>
                      <div class="modal-field"><label>Date Estimate Approved</label><input type="date" id="m-app" value="${est.approved}"></div>
                      <div class="modal-field"><label>Date Signed/Auth (Clears Badge)</label><input type="date" id="m-auth" value="${est.workAuth || ''}"></div>
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
                  const manuals = Store.get(CONFIG.KEYS.MANUAL).filter(m => m.uniqueId !== est.uniqueId);
                  Store.save(CONFIG.KEYS.MANUAL, manuals);
                  location.reload();
              };
          }

          // 3. Updated Save Logic using CONFIG and Store
          document.getElementById('m-sav').onclick = () => {
              const fol = document.getElementById('m-fol').value;
              const con = document.getElementById('m-con').value;

              if (isCms) {
                  const ov = Store.get(CONFIG.KEYS.OVERRIDE);
                  ov[est.jobNumber] = { lastFollowUp: fol, lastContact: con };
                  Store.save(CONFIG.KEYS.OVERRIDE, ov);
              } else {
                  let mans = Store.get(CONFIG.KEYS.MANUAL);
                  const updatedData = {
                      ...est,
                      lastFollowUp: fol,
                      lastContact: con,
                      type: document.getElementById('m-type').value,
                      jobNumber: document.getElementById('m-job').value,
                      customer: document.getElementById('m-cust').value,
                      estimator: document.getElementById('m-est').value,
                      received: document.getElementById('m-rec').value,
                      inspected: document.getElementById('m-ins').value,
                      sent: document.getElementById('m-sen').value,
                      approved: document.getElementById('m-app').value,
                      workAuth: document.getElementById('m-auth').value,
                      url: document.getElementById('m-url').value,
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

              // 3. Trigger a re-render of the current estimator's view
              View.render(est.estimator);
          };
      }
    };

    window.App.init();
})();
