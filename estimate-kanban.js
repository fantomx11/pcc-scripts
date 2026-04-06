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
    const est = allEstimates.get(id) || { estimator: "Unassigned", isManual: true, type: "SUPP" };
    const isCms = est.type === 'CMS';

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
        <div class="modal-box">
            <h3>${isCms ? 'Log Contact' : 'Edit Supplement'}</h3>
            <div class="modal-field"><label>Last Follow Up (Reset Aging)</label><input type="date" id="f-fol" value="${est.lastFollowUp}"></div>
            <div class="modal-field"><label>Last Contact (Weekly)</label><input type="date" id="f-con" value="${est.lastContact}"></div>
            ${!isCms ? `<div class="modal-field"><label>Job #</label><input type="text" id="f-job" value="${est.jobNumber || ''}"></div>` : ''}
            <div class="modal-btns">
                <button onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                <button class="btn-save" id="btn-save">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("btn-save").onclick = () => {
        const fol = document.getElementById("f-fol").value;
        const con = document.getElementById("f-con").value;

        if (isCms) {
            const ov = getStorage(CMS_OVERRIDE_KEY);
            ov[est.jobNumber] = { lastFollowUp: fol, lastContact: con };
            saveStorage(CMS_OVERRIDE_KEY, ov);
        } else {
            let mans = getStorage(MANUAL_STORAGE_KEY);
            const data = { ...est, lastFollowUp: fol, lastContact: con, jobNumber: document.getElementById("f-job")?.value || est.jobNumber, uniqueId: est.uniqueId || Date.now().toString() };
            mans = est.uniqueId ? mans.map(m => m.uniqueId === est.uniqueId ? data : m) : [...mans, data];
            saveStorage(MANUAL_STORAGE_KEY, mans);
        }
        location.reload(); // Refresh to re-initialize with new merged data
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
    const filtered = [...allEstimates.values()].filter(e => e.estimator === estimator);
    
    // 1. Render Kanban Columns
    const phases = ["Inspection", "Estimate", "Approval", "Process"];
    phases.forEach(p => {
        const col = document.createElement("div");
        col.className = "phase-col";
        col.innerHTML = `<h3>${p.toUpperCase()}</h3>`;
        const cardList = document.createElement("div");
        cardList.className = "card-list";

        filtered.filter(e => e.phase === p && e.division !== "Warranty")
            .sort((a, b) => b.aging - a.aging)
            .forEach(est => {
                const card = document.createElement("div");
                card.className = `job-card ${est.isManual ? 'manual' : ''} ${est.severity}`;
                card.innerHTML = `
                    <div class="aging-tag">${est.aging}d</div>
                    <div style="font-weight:bold; font-size: 13px; color:#2c3e50;">${est.jobNumber}</div>
                    <div style="font-size:11px; color:#7f8c8d; margin-bottom:8px;">${est.customer}</div>
                    <div class="badges">
                        ${est.needsContact ? '<span class="badge badge-urgent">Contact Due</span>' : ''}
                        ${est.needsWorkAuth ? '<span class="badge badge-auth">Need Auth</span>' : ''}
                        ${est.needsSignedCO ? '<span class="badge badge-auth">Signed CO?</span>' : ''}
                    </div>
                `;
                card.onclick = () => openModal(est.uniqueId);
                cardList.appendChild(card);
            });
        col.appendChild(cardList);
        board.appendChild(col);
    });

    // 2. Render Sidebar for Specials
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    
    const addSidebarSection = (title, items, color) => {
        if (items.length === 0) return;
        const sec = document.createElement("div");
        sec.innerHTML = `<h4>${title} (${items.length})</h4>`;
        items.forEach(i => {
            const div = document.createElement("div");
            div.className = "sidebar-item";
            div.style.borderLeftColor = color;
            div.innerHTML = `<strong>${i.jobNumber}</strong><br>${i.customer}`;
            div.onclick = () => i.isManual ? openModal(i.uniqueId) : window.open(i.url, '_blank');
            sec.appendChild(div);
        });
        sidebar.appendChild(sec);
    };

    addSidebarSection("Warranty Jobs", filtered.filter(e => e.division === "Warranty"), "#3498db");
    addSidebarSection("Needs Processing", filtered.filter(e => e.needsProcessing), "#27ae60");
    addSidebarSection("Missing Deductible", filtered.filter(e => e.needsDeductibleEntry), "#e67e22");

    board.appendChild(sidebar);
}

init();