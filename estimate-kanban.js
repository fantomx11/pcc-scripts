const MANUAL_STORAGE_KEY = "manual_estimates_v8";
const CMS_OVERRIDE_KEY = "cms_overrides_v1";
const allEstimates = new Map();

class Estimate {
    constructor(data) {
        // Core Identification
        this.uniqueId = data.uniqueId || `cms-${data.jobNumber}`;
        this.jobNumber = data.jobNumber;
        this.customer = data.customer;
        this.estimator = data.estimator || "Unassigned";
        this.division = data.division;
        this.type = data.type || 'CMS'; 
        this.url = data.url || "#";
        this.isManual = !!data.isManual;

        // Dates
        this.received = data.received;
        this.inspected = data.inspected;
        this.sent = data.sent;
        this.approved = data.approved;
        this.workAuth = data.workAuth;
        
        // Tracking/Overwrites (Prioritize data passed in, usually from Storage)
        this.lastFollowUp = data.lastFollowUp || "";
        this.lastContact = data.lastContact || "";

        // Financials
        this.origEstimate = this._parseCurrency(data.origEstimate);
        this.deductible = this._parseCurrency(data.deductible);

        allEstimates.set(this.uniqueId, this);
    }

    _parseCurrency(val) {
        if (!val) return 0;
        return parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
    }

    _getDaysSince(dateStr) {
        if (!dateStr || dateStr.toLowerCase().includes("null")) return 0;
        const diff = Math.floor((new Date() - new Date(dateStr)) / 864e5);
        return isNaN(diff) || diff < 0 ? 0 : diff;
    }

    get phase() {
        const hasDate = (d) => d && d !== "" && !d.toLowerCase().includes("null");
        if (this.division === "Warranty") return "Warranty";
        if (hasDate(this.approved)) return "Process";
        if (hasDate(this.sent)) return "Approval";
        if (hasDate(this.inspected)) return "Estimate";
        return "Inspection";
    }

    get aging() {
        const hasDate = (d) => d && d !== "" && !d.toLowerCase().includes("null");
        const refDate = (this.phase === "Approval" && hasDate(this.lastFollowUp)) 
            ? this.lastFollowUp 
            : (this.phase === "Process" ? this.approved : 
              (this.phase === "Estimate" ? this.inspected : 
              (this.phase === "Inspection" || this.phase === "Warranty" ? this.received : null)));
        return this._getDaysSince(refDate);
    }

    get needsContact() {
        const effectiveContact = this.lastContact || this.inspected || this.received;
        return this.phase === "Approval" && this._getDaysSince(effectiveContact) > 7;
    }

    get needsProcessing() { return this.phase === "Process" && this.origEstimate === 0; }
    get needsSignedCO() { return this.type === "CO" && !this.workAuth; }
    get needsWorkAuth() { return this.type === "CMS" && !this.workAuth; }
    get needsDeductibleEntry() { return this.type === "CMS" && this.division === "Structure" && this.deductible === 0; }

    get severity() {
        if (this.aging >= 10) return 'danger';
        if (this.aging >= 5) return 'warning';
        return 'normal';
    }
}

// --- Data Persistence ---
const getStorage = (key) => JSON.parse(localStorage.getItem(key) || (key.includes('overrides') ? "{}" : "[]"));
const saveStorage = (key, data) => localStorage.setItem(key, JSON.stringify(data));

// --- Scraper Engine ---
function scrapePage() {
    const headerRow = document.querySelector(".rgHeaderWrapper thead tr");
    if (!headerRow) return [];

    const cells = [...headerRow.querySelectorAll("th")].map(c => c.textContent.trim().toLowerCase());
    const find = (txt) => cells.indexOf(txt.toLowerCase());

    const COL = {
        jobNum: find("Job Number"), customer: find("Customer"), estimator: find("Estimator"),
        received: find("Date Received"), inspected: find("Date Inspected"), sent: find("Date Estimate Sent"),
        approved: find("Date Estimate Approved"), workAuth: find("Date of Work Authorization"),
        deductible: find("Deductible Amount"), division: find("Division"), 
        origEstimate: find("Original Estimate"), xactId: find("Xact TransactionID")
    };

    return [...document.querySelectorAll("tr.rgRow, tr.rgAltRow")].map(row => {
        const c = row.querySelectorAll("td");
        const getVal = (idx) => idx !== -1 ? c[idx].textContent.trim() : "";
        return {
            jobNumber: getVal(COL.jobNum),
            customer: getVal(COL.customer),
            estimator: getVal(COL.estimator) || "Unassigned",
            received: getVal(COL.received),
            inspected: getVal(COL.inspected),
            sent: getVal(COL.sent),
            approved: getVal(COL.approved),
            workAuth: getVal(COL.workAuth),
            deductible: getVal(COL.deductible),
            division: getVal(COL.division),
            origEstimate: getVal(COL.origEstimate),
            xactId: getVal(COL.xactId),
            url: c[COL.jobNum]?.querySelector("a")?.href || "#",
            isManual: false
        };
    }).filter(j => j.jobNumber);
}

// --- Main Controller ---
async function init() {
    window.estAccumulator = (window.estAccumulator || []).concat(scrapePage());
    
    const nextBtn = document.querySelector(".rgNumPart .rgCurrentPage")?.nextElementSibling;
    if (nextBtn && nextBtn.tagName === "A") {
        nextBtn.click();
        return;
    }

    // Processing Final Data
    const cmsScraped = window.estAccumulator;
    const manualJobs = getStorage(MANUAL_STORAGE_KEY);
    const overrides = getStorage(CMS_OVERRIDE_KEY);

    // 1. Initialize Manual Jobs
    manualJobs.forEach(m => new Estimate(m));

    // 2. Initialize CMS Jobs (Merging with overrides)
    cmsScraped.forEach(s => {
        const extra = overrides[s.jobNumber] || {};
        new Estimate({ ...s, ...extra });
    });

    renderDashboard();
}

function renderDashboard(activeEstimator = null) {
    const list = [...allEstimates.values()];
    document.body.innerHTML = `<style>${getStyles()}</style>`;
    
    const container = document.createElement("div");
    container.className = "dash-container";
    
    // Tab Generation
    const estimators = [...new Set(list.map(e => e.estimator))].sort();
    const tabsHTML = estimators.map(est => {
        const count = list.filter(e => e.estimator === est).length;
        return `<button class="tab-btn ${est === activeEstimator ? 'active' : ''}" onclick="renderDashboard('${est}')">${est} (${count})</button>`;
    }).join('');

    container.innerHTML = `
        <div class="tabs-bar">
            <div class="tabs">${tabsHTML}</div>
            <button class="add-btn" onclick="openModal()">+ ADD SUPP/CO</button>
        </div>
        <div class="main-content" id="board"></div>
    `;
    document.body.appendChild(container);

    if (!activeEstimator && estimators.length) return renderDashboard(estimators[0]);
    updateBoard(activeEstimator);
}

function openModal(id = null) {
    const isNew = !id;
    // Get existing estimate or create a skeleton for a new manual one
    const est = allEstimates.get(id) || { 
        estimator: document.querySelector(".tab-btn.active")?.innerText.split(' ')[0] || "Unassigned", 
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
            
            <div class="modal-btns">
                ${(!isNew && !isCms) ? '<button class="btn-delete" id="m-del" style="background:#e74c3c; color:white; margin-right:auto;">Delete</button>' : ''}
                <button onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button class="btn-save" id="m-sav" style="background:#3498db; color:white;">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Restore the URL -> Job Number listener
    const urlInput = document.getElementById('m-url');
    const jobInput = document.getElementById('m-job');
    if (urlInput && jobInput) {
        urlInput.addEventListener('input', (e) => {
            const match = e.target.value.match(/[?&]JobNumber=([^&#]+)/);
            if (match && match[1]) jobInput.value = decodeURIComponent(match[1]);
        });
    }

    // Delete Logic
    if (document.getElementById('m-del')) {
        document.getElementById('m-del').onclick = () => {
            const mans = getStorage(MANUAL_STORAGE_KEY).filter(m => m.uniqueId !== est.uniqueId);
            saveStorage(MANUAL_STORAGE_KEY, mans);
            location.reload();
        };
    }

    // Save Logic
    document.getElementById('m-sav').onclick = () => {
        const fol = document.getElementById('m-fol').value;
        const con = document.getElementById('m-con').value;

        if (isCms) {
            const ov = getStorage(CMS_OVERRIDE_KEY);
            ov[est.jobNumber] = { lastFollowUp: fol, lastContact: con };
            saveStorage(CMS_OVERRIDE_KEY, ov);
        } else {
            let mans = getStorage(MANUAL_STORAGE_KEY);
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
            
            saveStorage(MANUAL_STORAGE_KEY, mans);
        }
        location.reload();
    };
}

function getStyles() {
    return `
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f0f2f5; margin: 0; padding: 10px; }
        .dash-container { display: flex; flex-direction: column; height: 97vh; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        
        /* Navigation & Tabs */
        .tabs-bar { display: flex; background: #2c3e50; align-items: center; justify-content: space-between; padding: 0 15px; }
        .tabs { display: flex; overflow-x: auto; }
        .tab-btn { padding: 14px 20px; border: none; background: transparent; color: #95a5a6; cursor: pointer; border-bottom: 3px solid transparent; white-space: nowrap; transition: 0.2s; }
        .tab-btn.active { background: #34495e; color: #fff; border-bottom-color: #3498db; font-weight: bold; }
        .add-btn { background: #27ae60; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }

        /* Kanban Layout */
        .main-content { display: flex; flex: 1; overflow: hidden; padding: 15px; gap: 15px; }
        .phase-col { flex: 1; display: flex; flex-direction: column; background: #ebedef; border-radius: 6px; padding: 10px; min-width: 250px; }
        .phase-col h3 { text-align: center; margin: 0 0 12px 0; color: #2c3e50; font-size: 0.85em; letter-spacing: 1px; border-bottom: 2px solid #bdc3c7; padding-bottom: 5px; }
        .card-list { flex: 1; overflow-y: auto; }

        /* Cards */
        .job-card { background: #fff; padding: 12px; margin-bottom: 10px; border-radius: 4px; border-left: 5px solid #bdc3c7; position: relative; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .job-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .job-card.manual { border-right: 4px solid #f1c40f; }
        .job-card.warning { border-left-color: #f39c12; }
        .job-card.danger { border-left-color: #e74c3c; }

        /* Card Content */
        .aging-tag { position: absolute; top: 10px; right: 10px; font-weight: bold; color: #7f8c8d; font-size: 0.75em; }
        .badge { display: inline-block; padding: 2px 6px; font-size: 10px; border-radius: 3px; margin-top: 5px; color: white; margin-right: 4px; font-weight: bold; text-transform: uppercase; }
        .badge-urgent { background: #e74c3c; }
        .badge-auth { background: #8e44ad; }
        .badge-manual { background: #f39c12; }

        /* Sidebar */
        .sidebar { width: 280px; background: #f8f9fa; border-left: 1px solid #dee2e6; padding: 15px; overflow-y: auto; }
        .sidebar h4 { margin: 0 0 12px 0; font-size: 11px; border-bottom: 2px solid #3498db; padding-bottom: 5px; color: #34495e; }
        .sidebar-item { font-size: 11px; padding: 8px; background: #fff; border: 1px solid #eee; border-radius: 3px; margin-bottom: 8px; cursor: pointer; border-left: 3px solid #ccc; }
        
        /* Modals */
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-box { background: white; padding: 20px; border-radius: 8px; width: 400px; }
        .modal-field { margin-bottom: 15px; }
        .modal-field label { display: block; font-size: 11px; font-weight: bold; color: #7f8c8d; margin-bottom: 5px; }
        .modal-field input { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    `;
}

function updateBoard(estimator) {
    const board = document.getElementById("board");
    const allJobs = [...allEstimates.values()];
    const filtered = allJobs.filter(e => e.estimator === estimator);
    
    // 1. Render Kanban Columns (Inspection, Estimate, Approval, Process)
    const phases = ["Inspection", "Estimate", "Approval", "Process"];
    phases.forEach(p => {
        const col = document.createElement("div");
        col.className = "phase-col";
        col.innerHTML = `<h3>${p.toUpperCase()}</h3>`;
        const cardList = document.createElement("div");
        cardList.className = "card-list";

        // Filter out Warranty from the main Kanban columns as it lives in the sidebar
        filtered.filter(e => e.phase === p && e.division !== "Warranty")
            .sort((a, b) => b.aging - a.aging)
            .forEach(est => {
                const card = document.createElement("div");
                card.className = `job-card ${est.isManual ? 'manual' : ''} ${est.severity}`;
                card.innerHTML = `
                    <div class="aging-tag">${est.aging}d</div>
                    <div style="font-weight:bold; font-size: 12px; color:#2c3e50;">${est.jobNumber}</div>
                    <div style="font-size:11px; color:#7f8c8d;">${est.customer}</div>
                    <div class="badges">
                        ${est.isManual ? `<span class="badge badge-manual">EDIT ${est.type}</span>` : ''}
                        ${est.needsContact ? '<span class="badge badge-urgent">CONTACT DUE</span>' : ''}
                        ${est.needsWorkAuth ? '<span class="badge badge-auth">NEED AUTH</span>' : ''}
                        ${est.needsSignedCO ? '<span class="badge badge-auth">NEEDS SIGNED CO</span>' : ''}
                    </div>
                `;
                card.onclick = () => openModal(est.uniqueId);
                cardList.appendChild(card);
            });
        col.appendChild(cardList);
        board.appendChild(col);
    });

    // 2. The Sidebar (Warranty, Processing, etc.)
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    
    const createSidebarSection = (title, jobList, accentColor) => {
        if (jobList.length === 0) return;
        const section = document.createElement("div");
        section.className = "sidebar-section";
        section.innerHTML = `<h4>${title} (${jobList.length})</h4>`;
        
        jobList.forEach(j => {
            const item = document.createElement("div");
            item.className = "sidebar-item";
            item.style.borderLeft = `3px solid ${accentColor}`;
            item.innerHTML = `<b>${j.jobNumber}</b><br>${j.customer}`;
            
            item.onclick = () => {
                // If it's a manual job or specifically needs a modal (like contact), open modal
                if (j.isManual || title.includes("Contact")) {
                    openModal(j.uniqueId);
                } else {
                    window.open(j.url, "_blank");
                }
            };
            section.appendChild(item);
        });
        sidebar.appendChild(section);
    };

    // Populate Sidebar using the class getters
    createSidebarSection("Contact Needed", filtered.filter(j => j.needsContact), "#e74c3c");
    createSidebarSection("Warranty Jobs", filtered.filter(j => j.division === "Warranty"), "#3498db");
    createSidebarSection("Needs Processing", filtered.filter(j => j.needsProcessing), "#27ae60");
    createSidebarSection("Needs Work Auth", filtered.filter(j => j.needsWorkAuth), "#8e44ad");
    createSidebarSection("Needs Signed CO", filtered.filter(j => j.needsSignedCO), "#8e44ad");
    createSidebarSection("Enter Deductible", filtered.filter(j => j.needsDeductibleEntry), "#d35400");

    board.appendChild(sidebar);
}

init();