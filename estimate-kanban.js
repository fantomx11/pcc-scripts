javascript:!function() {
    const MANUAL_STORAGE_KEY = "manual_estimates_v8";
    const CMS_OVERRIDE_KEY = "cms_overrides_v1";

    const getDaysSince = (dateStr) => {
        if (!dateStr || dateStr === "" || dateStr.toLowerCase().includes("null")) return 0;
        const diff = Math.floor((new Date() - new Date(dateStr)) / 864e5);
        return isNaN(diff) || diff < 0 ? 0 : diff;
    };

    const findIdx = (headerCells, text) => 
        headerCells.findIndex(c => c.textContent.trim().toLowerCase() === text.toLowerCase());

    const getManualJobs = () => JSON.parse(localStorage.getItem(MANUAL_STORAGE_KEY) || "[]");
    const saveManualJobs = (jobs) => localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(jobs));
    
    // Typo fixed here: CMS_OVERRIDE_KEY
    const getOverrides = () => JSON.parse(localStorage.getItem(CMS_OVERRIDE_KEY) || "{}");
    const saveOverrides = (data) => localStorage.setItem(CMS_OVERRIDE_KEY, JSON.stringify(data));

    const headerRow = document.querySelector(".rgHeaderWrapper thead tr");
    let currentPageJobs = [];

    if (headerRow) {
        const headerCells = [...headerRow.querySelectorAll("th")];
        const COL = {
            jobNum: findIdx(headerCells, "Job Number"),
            customer: findIdx(headerCells, "Customer"),
            estimator: findIdx(headerCells, "Estimator"),
            received: findIdx(headerCells, "Date Received"),
            inspected: findIdx(headerCells, "Date Inspected"),
            sent: findIdx(headerCells, "Date Estimate Sent"),
            approved: findIdx(headerCells, "Date Estimate Approved"),
            workAuth: findIdx(headerCells, "Date of Work Authorization"),
            deductible: findIdx(headerCells, "Deductible Amount"),
            division: findIdx(headerCells, "Division"),
            origEstimate: findIdx(headerCells, "Original Estimate"),
            xactId: findIdx(headerCells, "Xact TransactionID")
        };

        currentPageJobs = [...document.querySelectorAll("tr.rgRow, tr.rgAltRow")].map(row => {
            const cells = row.querySelectorAll("td");
            const getVal = (idx) => idx !== -1 ? cells[idx].textContent.trim() : "";
            const jobNum = getVal(COL.jobNum);
            if (!jobNum) return null;

            return {
                uniqueId: `cms-${jobNum}`,
                jobNumber: jobNum,
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
                isManual: false,
                type: 'CMS',
                url: cells[COL.jobNum]?.querySelector("a")?.href || "#"
            };
        }).filter(Boolean);
    }

    window.estAccumulator = (window.estAccumulator || []).concat(currentPageJobs);
    
    if (document.querySelector(".rgNumPart")?.querySelector(".rgCurrentPage")?.nextElementSibling?.tagName === "A") {
        document.querySelector(".rgNumPart").querySelector(".rgCurrentPage").nextElementSibling.click();
    } else {
        const cmsData = window.estAccumulator || [];
        window.estAccumulator = null;
        renderDashboard(cmsData);
    }

    function processJobLogic(job, overrides) {
        const extra = overrides[job.jobNumber] || {};
        job.lastFollowUp = job.lastFollowUp || extra.lastFollowUp || "";
        job.lastContact = job.lastContact || extra.lastContact || "";

        const origEstFloat = parseFloat((job.origEstimate || "").replace(/[^0-9.-]+/g,"")) || 0;
        const dedFloat = parseFloat((job.deductible || "").replace(/[^0-9.-]+/g,"")) || 0;
        job.isWarranty = job.division === "Warranty";
        const hasDate = (d) => d && d !== "" && !d.toLowerCase().includes("null");

        if (job.isWarranty) {
            job.phase = "Warranty";
            job.aging = getDaysSince(job.received);
        } else if (hasDate(job.approved)) {
            job.phase = "Process";
            job.aging = getDaysSince(job.approved);
        } else if (hasDate(job.sent)) {
            job.phase = "Approval";
            job.aging = hasDate(job.lastFollowUp) ? getDaysSince(job.lastFollowUp) : getDaysSince(job.sent);
        } else if (hasDate(job.inspected)) {
            job.phase = "Estimate";
            job.aging = getDaysSince(job.inspected);
        } else {
            job.phase = "Inspection";
            job.aging = getDaysSince(job.received);
        }

        const effectiveContactDate = job.lastContact || job.inspected || job.received;
        job.needsContact = (job.phase === "Approval" && getDaysSince(effectiveContactDate) > 7);
        job.needsProcessing = (job.phase === "Process" && origEstFloat === 0);
        
        if (job.isManual) {
            job.needsSignedCO = (job.type === "CO" && !hasDate(job.workAuth));
        } else {
            job.needsWorkAuth = !hasDate(job.workAuth);
            job.needsDeductibleEntry = (job.division === "Structure" && dedFloat === 0);
        }
        return job;
    }

    function renderDashboard(cmsData, activeEstimator = null) {
        const manualData = getManualJobs();
        const overrides = getOverrides();
        const allJobs = [...cmsData, ...manualData].map(j => processJobLogic(j, overrides));
        
        document.body.innerHTML = "";
        const style = document.createElement("style");
        style.innerHTML = `
            body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; padding: 10px; }
            .dash-container { display: flex; flex-direction: column; height: 97vh; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
            .tabs-bar { display: flex; background: #2c3e50; align-items: center; justify-content: space-between; padding-right: 15px; }
            .tabs { display: flex; overflow-x: auto; }
            .tab-btn { padding: 14px 20px; border: none; background: transparent; color: #95a5a6; cursor: pointer; border-bottom: 3px solid transparent; white-space: nowrap; }
            .tab-btn.active { background: #34495e; color: #fff; border-bottom-color: #3498db; font-weight: bold; }
            .add-btn { background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; }
            .main-content { display: flex; flex: 1; overflow: hidden; padding: 15px; gap: 15px; }
            .phase-col { flex: 1; display: flex; flex-direction: column; background: #ebedef; border-radius: 6px; padding: 10px; min-width: 200px; }
            .phase-col h3 { text-align: center; margin: 0 0 12px 0; color: #2c3e50; font-size: 0.75em; letter-spacing: 1px; }
            .card-list { flex: 1; overflow-y: auto; }
            .job-card { background: #fff; padding: 10px; margin-bottom: 10px; border-radius: 4px; border-left: 5px solid #bdc3c7; position: relative; }
            .job-card.manual { border-right: 4px solid #f1c40f; }
            .job-card.warning { border-left-color: #f39c12; }
            .job-card.danger { border-left-color: #e74c3c; }
            .aging-tag { position: absolute; top: 10px; right: 10px; font-weight: bold; color: #7f8c8d; font-size: 0.75em; }
            .badge { display: inline-block; padding: 2px 5px; font-size: 9px; border-radius: 3px; margin-top: 5px; color: white; margin-right: 3px; font-weight: bold; text-decoration: none; border: none; cursor: pointer; }
            .badge-manual { background: #f39c12; }
            .badge-auth { background: #8e44ad; }
            .badge-deduct { background: #d35400; }
            .badge-process { background: #27ae60; }
            .badge-xact { background: #3498db; }
            .badge-urgent { background: #e74c3c; }
            .sidebar { width: 260px; background: #f8f9fa; border-left: 1px solid #dee2e6; padding: 15px; overflow-y: auto; }
            .sidebar h4 { margin: 0 0 12px 0; font-size: 11px; border-bottom: 2px solid #3498db; padding-bottom: 5px; color: #34495e; }
            .sidebar-section { margin-bottom: 25px; }
            .sidebar-item { font-size: 11px; padding: 8px; background: #fff; border: 1px solid #eee; border-radius: 3px; margin-bottom: 5px; cursor: pointer; }
            .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
            .modal-box { background: white; padding: 20px; border-radius: 8px; width: 420px; max-width: 90%; max-height: 90vh; overflow-y: auto; }
            .modal-field { margin-bottom: 12px; }
            .modal-field label { display: block; font-size: 11px; font-weight: bold; color: #7f8c8d; margin-bottom: 4px; }
            .modal-field input, .modal-field select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
            .modal-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .modal-btns button { padding: 8px 16px; border-radius: 4px; cursor: pointer; border: none; font-weight: bold; }
            .btn-save { background: #3498db; color: white; }
            .btn-cancel { background: #95a5a6; color: white; }
            .btn-delete { background: #e74c3c; color: white; margin-right: auto; }
        `;
        document.head.appendChild(style);

        const container = document.createElement("div");
        container.className = "dash-container";
        const tabsBar = document.createElement("div");
        tabsBar.className = "tabs-bar";
        const tabs = document.createElement("div");
        tabs.className = "tabs";
        
        const addBtn = document.createElement("button");
        addBtn.className = "add-btn";
        addBtn.innerText = "+ ADD SUPP/CO";
        addBtn.onclick = () => openEditModal(null, cmsData, document.querySelector(".tab-btn.active")?.getAttribute("data-est"));

        tabsBar.appendChild(tabs);
        tabsBar.appendChild(addBtn);
        const board = document.createElement("div");
        board.className = "main-content";

        const estimators = [...new Set(allJobs.map(j => j.estimator))].sort();
        estimators.forEach(est => {
            const btn = document.createElement("button");
            btn.className = "tab-btn";
            btn.setAttribute("data-est", est);
            btn.innerText = `${est} (${allJobs.filter(j => j.estimator === est).length})`;
            btn.onclick = () => {
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                updateBoard(est, allJobs, board, cmsData);
            };
            tabs.appendChild(btn);
        });

        container.appendChild(tabsBar);
        container.appendChild(board);
        document.body.appendChild(container);

        let targetTab = [...tabs.children].find(b => b.getAttribute("data-est") === activeEstimator);
        if (targetTab) targetTab.click();
        else if (tabs.firstChild) tabs.firstChild.click();
    }

    function updateBoard(estimator, allJobs, board, cmsData) {
        board.innerHTML = "";
        const filtered = allJobs.filter(j => j.estimator === estimator);
        const phases = ["Inspection", "Estimate", "Approval", "Process"];

        phases.forEach(p => {
            const col = document.createElement("div");
            col.className = "phase-col";
            col.innerHTML = `<h3>${p.toUpperCase()}</h3>`;
            const list = document.createElement("div");
            list.className = "card-list";

            filtered.filter(j => j.phase === p && !j.isWarranty)
                .sort((a, b) => b.aging - a.aging)
                .forEach(job => {
                    const card = document.createElement("div");
                    card.className = `job-card ${job.isManual ? 'manual' : ''}`;
                    if (job.aging >= 10) card.classList.add("danger");
                    else if (job.aging >= 5) card.classList.add("warning");

                    card.innerHTML = `
                        <div class="aging-tag">${job.aging}d</div>
                        <div style="font-weight:bold; font-size: 12px;">
                            <a href="${job.url || '#'}" target="_blank" style="text-decoration:none; color:#2980b9;">${job.jobNumber}</a>
                        </div>
                        <div style="font-size:11px; margin-top:2px;">${job.customer}</div>
                        <div style="margin-top: 5px;">
                            ${job.isManual ? `<span class="badge badge-manual">EDIT ${job.type}</span>` : `<span class="badge badge-contact" style="background:#3498db">LOG CONTACT</span>`}
                            ${job.xactId ? `<a href="https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${job.xactId}" target="_blank" class="badge badge-xact">XACT</a>` : ''}
                            ${job.needsContact ? '<span class="badge badge-urgent">CONTACT DUE</span>' : ''}
                            ${job.needsSignedCO ? '<span class="badge badge-auth">NEEDS SIGNED CO</span>' : ''}
                            ${job.needsWorkAuth ? '<span class="badge badge-auth">NEED AUTH</span>' : ''}
                            ${job.needsDeductibleEntry ? '<span class="badge badge-deduct">DEDUCT $0</span>' : ''}
                            ${job.needsProcessing ? '<span class="badge badge-process">PROCESS</span>' : ''}
                        </div>
                    `;

                    const btn = card.querySelector('.badge-manual, .badge-contact, .badge-urgent');
                    if(btn) btn.onclick = () => openEditModal(job, cmsData, estimator);
                    
                    list.appendChild(card);
                });
            col.appendChild(list);
            board.appendChild(col);
        });

        const sidebar = document.createElement("div");
        sidebar.className = "sidebar";
        
        const createSidebarList = (title, jobList, accentColor, actionType) => {
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
                    if (actionType === "modal" || j.isManual) {
                        openEditModal(j, cmsData, estimator);
                    } else {
                        window.open(j.url, "_blank");
                    }
                };
                section.appendChild(item);
            });
            sidebar.appendChild(section);
        };

        createSidebarList("Contact Needed", filtered.filter(j => j.needsContact), "#e74c3c", "modal");
        createSidebarList("Warranty Jobs", filtered.filter(j => j.isWarranty), "#3498db", "url");
        createSidebarList("Needs Processing", filtered.filter(j => j.needsProcessing), "#27ae60", "url");
        createSidebarList("Needs Work Auth", filtered.filter(j => j.needsWorkAuth), "#8e44ad", "url");
        createSidebarList("Needs Signed CO", filtered.filter(j => j.needsSignedCO), "#8e44ad", "modal");
        createSidebarList("Enter Deductible", filtered.filter(j => j.needsDeductibleEntry), "#d35400", "url");
        board.appendChild(sidebar);
    }

    function openEditModal(jobToEdit, cmsData, currentEstimator) {
        const isNew = !jobToEdit;
        const isCms = jobToEdit && jobToEdit.type === 'CMS';
        const job = jobToEdit || { jobNumber: "", customer: "", estimator: currentEstimator || "Unassigned", isManual: true, type: "SUPP", lastFollowUp: "", lastContact: "", url: "", received: "", inspected: "", sent: "", approved: "", workAuth: "" };

        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.innerHTML = `
            <div class="modal-box">
                <h2 style="margin-top:0">${isCms ? 'Log CMS Contact' : (isNew ? 'Add Supplement' : 'Edit Entry')}</h2>
                <div class="modal-field"><label>Last Follow Up (Resets Aging)</label><input type="date" id="m-fol" value="${job.lastFollowUp || ''}"></div>
                <div class="modal-field"><label>Last Contact (Weekly Check)</label><input type="date" id="m-con" value="${job.lastContact || ''}"></div>
                
                ${!isCms ? `
                    <hr>
                    <div class="modal-field"><label>Job Slideboard URL (Auto-fills Job #)</label><input type="text" id="m-url" value="${job.url || ''}"></div>
                    <div class="modal-field"><label>Type</label><select id="m-type"><option value="SUPP" ${job.type==='SUPP'?'selected':''}>Supplement</option><option value="CO" ${job.type==='CO'?'selected':''}>Change Order</option></select></div>
                    <div class="modal-field"><label>Job #</label><input type="text" id="m-job" value="${job.jobNumber}"></div>
                    <div class="modal-field"><label>Customer</label><input type="text" id="m-cust" value="${job.customer}"></div>
                    <div class="modal-field"><label>Estimator</label><input type="text" id="m-est" value="${job.estimator}"></div>
                    
                    <div class="modal-field"><label>Date Received</label><input type="date" id="m-rec" value="${job.received}"></div>
                    <div class="modal-field"><label>Date Inspected</label><input type="date" id="m-ins" value="${job.inspected}"></div>
                    <div class="modal-field"><label>Date Estimate Sent</label><input type="date" id="m-sen" value="${job.sent}"></div>
                    <div class="modal-field"><label>Date Estimate Approved</label><input type="date" id="m-app" value="${job.approved}"></div>
                    <div class="modal-field"><label>Date CO Signed (Clears Signed Badge)</label><input type="date" id="m-auth" value="${job.workAuth || ''}"></div>
                ` : `<p style="font-size:12px"><b>Job:</b> ${job.jobNumber} - ${job.customer}</p>`}
                
                <div class="modal-btns">
                    ${(!isNew && !isCms) ? '<button class="btn-delete" id="m-del">DELETE</button>' : ''}
                    <button class="btn-cancel" id="m-can">Cancel</button>
                    <button class="btn-save" id="m-sav">Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Auto-fill Job Number listener restored
        const urlInput = document.getElementById('m-url');
        const jobInput = document.getElementById('m-job');
        if (urlInput && jobInput) {
            urlInput.addEventListener('input', (e) => {
                const val = e.target.value;
                const match = val.match(/[?&]JobNumber=([^&#]+)/);
                if (match && match[1]) jobInput.value = decodeURIComponent(match[1]);
            });
        }

        document.getElementById('m-can').onclick = () => overlay.remove();
        if (document.getElementById('m-del')) {
            document.getElementById('m-del').onclick = () => {
                saveManualJobs(getManualJobs().filter(m => m.uniqueId !== job.uniqueId));
                overlay.remove();
                renderDashboard(cmsData, currentEstimator);
            };
        }
        document.getElementById('m-sav').onclick = () => {
            const fol = document.getElementById('m-fol').value;
            const con = document.getElementById('m-con').value;

            if (isCms) {
                const overrides = getOverrides();
                overrides[job.jobNumber] = { lastFollowUp: fol, lastContact: con };
                saveOverrides(overrides);
            } else {
                let manuals = getManualJobs();
                const updated = {
                    ...job,
                    lastFollowUp: fol, lastContact: con,
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
                    uniqueId: job.uniqueId || Date.now().toString()
                };
                if (isNew) manuals.push(updated);
                else manuals = manuals.map(m => m.uniqueId === job.uniqueId ? updated : m);
                saveManualJobs(manuals);
            }
            overlay.remove();
            renderDashboard(cmsData, currentEstimator);
        };
    }
}();
