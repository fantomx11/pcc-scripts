javascript:!function() {
    const STORAGE_KEY = "open_estimates_v5";

    /* --- HELPERS --- */
    const getDaysSince = (dateStr) => {
        if (!dateStr || dateStr === "" || dateStr.toLowerCase().includes("null")) return 0;
        const diff = Math.ceil((new Date() - new Date(dateStr)) / 864e5);
        return isNaN(diff) ? 0 : diff;
    };

    const findIdx = (headerCells, text) => 
        headerCells.findIndex(c => c.textContent.trim().toLowerCase() === text.toLowerCase());

    /* --- SCRAPER --- */
    const headerRow = document.querySelector(".rgHeaderWrapper thead tr");
    if (!headerRow) return alert("Report header not found.");
    const headerCells = [...headerRow.querySelectorAll("th")];
    
    const COL = {
        jobNum: findIdx(headerCells, "Job Number"),
        customer: findIdx(headerCells, "Customer"),
        estimator: findIdx(headerCells, "Estimator"),
        received: findIdx(headerCells, "Date Received"),
        inspected: findIdx(headerCells, "Date Inspected"),
        sent: findIdx(headerCells, "Date Estimate Sent"),
        workAuth: findIdx(headerCells, "Date of Work Authorization"),
        deductible: findIdx(headerCells, "Deductible Amount"),
        division: findIdx(headerCells, "Division")
    };

    const currentPageJobs = [...document.querySelectorAll("tr.rgRow, tr.rgAltRow")].map(row => {
        const cells = row.querySelectorAll("td");
        const getVal = (idx) => idx !== -1 ? cells[idx].textContent.trim() : "";
        const jobNum = getVal(COL.jobNum);
        if (!jobNum) return null;

        const rawDeductible = getVal(COL.deductible);
        const dedFloat = parseFloat(rawDeductible.replace(/[^0-9.-]+/g,"")) || 0;
        const division = getVal(COL.division);

        const data = {
            jobNumber: jobNum,
            customer: getVal(COL.customer),
            estimator: getVal(COL.estimator) || "Unassigned",
            received: getVal(COL.received),
            inspected: getVal(COL.inspected),
            sent: getVal(COL.sent),
            workAuth: getVal(COL.workAuth),
            deductible: rawDeductible,
            division: division,
            url: cells[COL.jobNum]?.querySelector("a")?.href || "#"
        };

        if (!data.inspected) {
            data.phase = "Inspection";
            data.aging = getDaysSince(data.received);
        } else if (!data.sent) {
            data.phase = "Estimate";
            data.aging = getDaysSince(data.inspected);
        } else {
            data.phase = "Approval";
            data.aging = getDaysSince(data.sent);
        }

        data.needsWorkAuth = !data.workAuth || data.workAuth === "";
        data.needsDeductibleEntry = (division === "Structure" && dedFloat === 0);

        return data;
    }).filter(Boolean);

    window.estAccumulator = (window.estAccumulator || []).concat(currentPageJobs);
    
    const navPart = document.querySelector(".rgNumPart");
    const current = navPart?.querySelector(".rgCurrentPage");
    const nextBtn = current?.nextElementSibling;

    if (nextBtn && nextBtn.tagName === "A") {
        nextBtn.click();
    } else {
        const finalData = window.estAccumulator;
        window.estAccumulator = null;
        renderDashboard(finalData);
    }

    /* --- UI --- */
    function renderDashboard(allJobs) {
        document.body.innerHTML = "";
        const style = document.createElement("style");
        style.innerHTML = `
            body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; margin: 0; padding: 10px; }
            .dash-container { display: flex; flex-direction: column; height: 97vh; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
            .tabs { display: flex; background: #2c3e50; overflow-x: auto; }
            .tab-btn { padding: 14px 20px; border: none; background: transparent; color: #95a5a6; cursor: pointer; border-bottom: 3px solid transparent; }
            .tab-btn.active { background: #34495e; color: #fff; border-bottom-color: #3498db; font-weight: bold; }
            .main-content { display: flex; flex: 1; overflow: hidden; padding: 15px; gap: 15px; }
            .phase-col { flex: 1; display: flex; flex-direction: column; background: #ebedef; border-radius: 6px; padding: 10px; min-width: 250px; }
            .phase-col h3 { text-align: center; margin: 0 0 12px 0; color: #2c3e50; font-size: 0.85em; letter-spacing: 1px; }
            .card-list { flex: 1; overflow-y: auto; }
            .job-card { background: #fff; padding: 12px; margin-bottom: 10px; border-radius: 4px; border-left: 5px solid #bdc3c7; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .job-card.warning { border-left-color: #f39c12; }
            .job-card.danger { border-left-color: #e74c3c; }
            .aging-tag { position: absolute; top: 12px; right: 12px; font-weight: bold; color: #7f8c8d; font-size: 0.8em; }
            .badge { display: inline-block; padding: 3px 6px; font-size: 10px; border-radius: 3px; margin-top: 6px; color: white; margin-right: 4px; font-weight: bold; }
            .badge-auth { background: #8e44ad; }
            .badge-deduct { background: #d35400; }
            .sidebar { width: 280px; background: #f8f9fa; border-left: 1px solid #dee2e6; padding: 15px; overflow-y: auto; }
            .sidebar h4 { margin: 0 0 15px 0; font-size: 14px; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
            .sidebar-section { margin-bottom: 20px; }
            .sidebar-link { text-decoration: none; color: inherit; display: block; margin-bottom: 8px; transition: transform 0.1s; }
            .sidebar-link:hover { transform: translateX(5px); }
            .sidebar-item { font-size: 12px; padding: 8px; background: #fff; border: 1px solid #eee; border-radius: 3px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .sidebar-item b { color: #2980b9; }
        `;
        document.head.appendChild(style);

        const container = document.createElement("div");
        container.className = "dash-container";
        const tabs = document.createElement("div");
        tabs.className = "tabs";
        const board = document.createElement("div");
        board.className = "main-content";

        const estimators = [...new Set(allJobs.map(j => j.estimator))].sort();

        estimators.forEach(est => {
            const btn = document.createElement("button");
            btn.className = "tab-btn";
            btn.innerText = `${est} (${allJobs.filter(j => j.estimator === est).length})`;
            btn.onclick = () => {
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                updateBoard(est, allJobs, board);
            };
            tabs.appendChild(btn);
        });

        container.appendChild(tabs);
        container.appendChild(board);
        document.body.appendChild(container);
        if (tabs.firstChild) tabs.firstChild.click();
    }

    function updateBoard(estimator, allJobs, board) {
        board.innerHTML = "";
        const filtered = allJobs.filter(j => j.estimator === estimator);
        const phases = ["Inspection", "Estimate", "Approval"];

        phases.forEach(p => {
            const col = document.createElement("div");
            col.className = "phase-col";
            col.innerHTML = `<h3>${p.toUpperCase()}</h3>`;
            const list = document.createElement("div");
            list.className = "card-list";

            filtered.filter(j => j.phase === p)
                .sort((a, b) => b.aging - a.aging)
                .forEach(job => {
                    const card = document.createElement("div");
                    card.className = "job-card";
                    if (job.aging >= 10) card.classList.add("danger");
                    else if (job.aging >= 5) card.classList.add("warning");

                    card.innerHTML = `
                        <div class="aging-tag">${job.aging}d</div>
                        <div style="font-weight:bold;"><a href="${job.url}" target="_blank" style="text-decoration:none; color:#2980b9;">${job.jobNumber}</a></div>
                        <div style="font-size:12px; margin-top:2px;">${job.customer}</div>
                        ${job.needsWorkAuth ? '<span class="badge badge-auth">MISSING AUTH</span>' : ''}
                        ${job.needsDeductibleEntry ? '<span class="badge badge-deduct">DEDUCTIBLE $0</span>' : ''}
                    `;
                    list.appendChild(card);
                });
            col.appendChild(list);
            board.appendChild(col);
        });

        const sidebar = document.createElement("div");
        sidebar.className = "sidebar";

        const authJobs = filtered.filter(j => j.needsWorkAuth);
        const deductJobs = filtered.filter(j => j.needsDeductibleEntry);

        const createSidebarList = (title, jobList, accentColor) => {
            if (jobList.length === 0) return;
            const section = document.createElement("div");
            section.className = "sidebar-section";
            section.innerHTML = `<h4>${title} (${jobList.length})</h4>`;
            
            jobList.forEach(j => {
                const a = document.createElement("a");
                a.href = j.url;
                a.target = "_blank";
                a.className = "sidebar-link";
                a.innerHTML = `
                    <div class="sidebar-item" style="border-left: 3px solid ${accentColor}">
                        <b>${j.jobNumber}</b><br>
                        <span style="color:#666">${j.customer}</span>
                    </div>
                `;
                section.appendChild(a);
            });
            sidebar.appendChild(section);
        };

        createSidebarList("Needs Work Auth", authJobs, "#8e44ad");
        createSidebarList("Enter Deductible", deductJobs, "#d35400");

        board.appendChild(sidebar);
    }
}();
