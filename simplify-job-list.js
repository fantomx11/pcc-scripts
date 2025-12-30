javascript:!function() {
    const STORAGE_KEY = "job_manager_v2_storage";

    /* --- PERSISTENCE --- */
    const getStoredData = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const saveToStorage = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    /* --- UI HELPERS --- */
    function copyTextToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                console.log(`Copied Job Number: ${text}`);
            }).catch(err => fallbackCopyTextToClipboard(text));
        } else {
            fallbackCopyTextToClipboard(text);
        }
    }

    function fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand("copy"); } catch (err) {}
        document.body.removeChild(textArea);
    }

    function createTableCell(cellData) {
        const td = document.createElement("td");
        cellData.background && td.classList.add(cellData.background);
        td.style.padding = "8px 4px";
        cellData.className && td.classList.add(cellData.className);
        
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.alignItems = "center";
        wrapper.style.justifyContent = "space-between";
        cellData.color && (wrapper.style.color = cellData.color);

        let contentContainer = td;
        if (cellData.url) {
            contentContainer = document.createElement("a");
            contentContainer.href = cellData.url;
            contentContainer.target = "_blank";
            wrapper.appendChild(contentContainer);
        } else if (cellData.isButton) {
            const button = document.createElement("button");
            button.innerText = cellData.text;
            button.style.cursor = "pointer";
            button.style.padding = "2px 6px";
            button.style.border = "1px solid #ccc";
            button.style.borderRadius = "3px";
            button.style.fontSize = "small";
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                copyTextToClipboard(cellData.copyText);
                button.innerText = "Copied!";
                setTimeout(() => { button.innerText = cellData.text; }, 1000);
            });
            contentContainer = button;
            wrapper.appendChild(contentContainer);
        } else {
            contentContainer = wrapper;
        }

        if (!cellData.isButton) contentContainer.innerText = cellData.text;
        td.appendChild(wrapper);
        return td;
    }

    function parseCurrency(text) {
        return text ? parseFloat(text.replace(/[^0-9.-]+/g, "")) : 0;
    }

    /* --- SCRAPER CONFIG --- */
    const CRITICAL_FLAG_CLASS = "flag-critical",
          WARNING_FLAG_CLASS = "flag-warning",
          CLOSED_FLAG_CLASS = "flag-closed",
          VALIDATION_COLUMNS = ["Job Status", "Total Estimates", "Total Invoiced", "Total Collected", "Last Journal Note Event Date/Time"];

    const headerRow = document.querySelector(".rgHeaderWrapper thead tr");
    if (!headerRow) return alert("Header not found.");

    const headerCells = [...headerRow.querySelectorAll("th")];
    const COL_INDEX = {
        jobNumber: headerCells.findIndex(c => "Job Number" === c.textContent.trim()),
        customer: headerCells.findIndex(c => "Customer" === c.textContent.trim()),
        estimator: headerCells.findIndex(c => "Estimator" === c.textContent.trim()),
        xactId: headerCells.findIndex(c => "Xact TransactionID" === c.textContent.trim()),
        supervisor: headerCells.findIndex(c => "Supervisor" === c.textContent.trim()),
        foreman: headerCells.findIndex(c => "Foreman" === c.textContent.trim()),
        jobStatus: headerCells.findIndex(c => "Job Status" === c.textContent.trim()),
        totalCollected: headerCells.findIndex(c => "Total Collected" === c.textContent.trim()),
        totalEstimates: headerCells.findIndex(c => "Total Estimates" === c.textContent.trim()),
        totalInvoiced: headerCells.findIndex(c => "Total Invoiced" === c.textContent.trim()),
        accountingPerson: headerCells.findIndex(c => "Accounting Person" === c.textContent.trim()),
        lastJournalNoteDate: headerCells.findIndex(c => "Last Journal Note Event Date/Time" === c.textContent.trim())
    };

    const scrapedJobs = [...document.querySelectorAll("tr.rgRow, tr.rgAltRow")].map(tableRow => {
        const cells = tableRow.querySelectorAll("td");
        const jobNumber = cells[COL_INDEX.jobNumber].textContent.trim();
        const customerName = cells[COL_INDEX.customer].textContent.trim();
        if (!jobNumber || !customerName) return null;

        const est = (cells[COL_INDEX.estimator].textContent.trim() || "Unassigned").replace(":", "");
        const acc = (cells[COL_INDEX.accountingPerson].textContent.trim() || "Unassigned").replace(":", "");
        const sup = COL_INDEX.supervisor !== -1 ? (cells[COL_INDEX.supervisor].textContent.trim() || "Unassigned").replace(":", "") : "";
        const forName = COL_INDEX.foreman !== -1 ? (cells[COL_INDEX.foreman].textContent.trim() || "").replace(":", "") : "";
        const status = COL_INDEX.jobStatus !== -1 ? cells[COL_INDEX.jobStatus].textContent.trim() : "";
        const xact = COL_INDEX.xactId !== -1 ? cells[COL_INDEX.xactId].textContent.trim() : "";
        const journal = COL_INDEX.lastJournalNoteDate !== -1 ? cells[COL_INDEX.lastJournalNoteDate].textContent.trim() : "";

        const other = {};
        let jobFlagLevel = 0;
        const flagged = {};

        if (journal) {
            const diff = Math.ceil((new Date() - new Date(journal)) / 864e5);
            if (diff > 14) { jobFlagLevel = 2; flagged["Last Journal Note Event Date/Time"] = CRITICAL_FLAG_CLASS; }
            else if (diff > 7) { jobFlagLevel = 1; flagged["Last Journal Note Event Date/Time"] = WARNING_FLAG_CLASS; }
        }

        const eVal = parseCurrency(cells[COL_INDEX.totalEstimates]?.textContent),
              iVal = parseCurrency(cells[COL_INDEX.totalInvoiced]?.textContent),
              cVal = parseCurrency(cells[COL_INDEX.totalCollected]?.textContent);

        if (Math.abs(eVal - iVal) > .01) {
            jobFlagLevel = 2; flagged["Total Estimates"] = CRITICAL_FLAG_CLASS; flagged["Total Invoiced"] = CRITICAL_FLAG_CLASS;
        }
        if (["Waiting for Final Closure", "Completed without Paperwork"].includes(status) && Math.abs(cVal - iVal) > .01) {
            jobFlagLevel = 2; flagged["Job Status"] = CRITICAL_FLAG_CLASS; flagged["Total Collected"] = CRITICAL_FLAG_CLASS;
        }

        headerCells.forEach((h, i) => {
            const n = h.textContent.trim();
            if (i > 1 && !Object.values(COL_INDEX).includes(i)) {
                other[n] = { text: cells[i].textContent.trim(), background: flagged[n] };
            }
        });

        return {
            isClosed: false,
            estimator: est, supervisor: sup, foreman: forName || sup, accountingPerson: acc,
            flagged: jobFlagLevel,
            rowFlagClass: 1 === jobFlagLevel ? WARNING_FLAG_CLASS : 2 === jobFlagLevel ? CRITICAL_FLAG_CLASS : void 0,
            name: { text: customerName },
            dash: { text: jobNumber, url: cells[COL_INDEX.jobNumber].querySelector("a")?.href || "#" },
            copyJobNumber: { text: "Copy", copyText: jobNumber, isButton: true },
            xa: { text: xact ? "XactAnalysis" : "", url: xact ? `https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${xact}` : void 0 },
            jobStatus: { text: status, background: flagged["Job Status"] },
            totalCollected: { text: cells[COL_INDEX.totalCollected]?.textContent.trim(), background: flagged["Total Collected"] },
            estimates: { text: cells[COL_INDEX.totalEstimates]?.textContent.trim(), background: flagged["Total Estimates"] },
            invoiced: { text: cells[COL_INDEX.totalInvoiced]?.textContent.trim(), background: flagged["Total Invoiced"] },
            journalDate: { text: journal, background: flagged["Last Journal Note Event Date/Time"] },
            other: other
        };
    }).filter(Boolean);

    window.scrapedAccumulator = (window.scrapedAccumulator || []).concat(scrapedJobs);

    const navPart = document.querySelector(".rgNumPart"),
          current = navPart?.querySelector(".rgCurrentPage"),
          last = navPart?.querySelectorAll("a")[navPart.querySelectorAll("a").length - 1];

    if (last && current && !last.isSameNode(current)) {
        current.nextElementSibling?.click();
    } else {
        const live = window.scrapedAccumulator,
              stored = getStoredData(),
              liveIds = new Set(live.map(j => j.dash.text));

        const reconciled = [...live, ...stored.filter(s => !liveIds.has(s.dash.text)).map(s => ({...s, isClosed: true, rowFlagClass: CLOSED_FLAG_CLASS}))];
        saveToStorage(reconciled);
        window.finalScrapedData = reconciled;
        renderDashboard("estimator", false);
    }

    function renderDashboard(groupByKey, showClosed) {
        const allJobs = window.finalScrapedData;
        const visibleJobs = showClosed ? allJobs : allJobs.filter(j => !j.isClosed);
        
        let grouped = {};
        visibleJobs.forEach(j => {
            const k = j[groupByKey] || "Unassigned";
            grouped[k] = grouped[k] || [];
            grouped[k].push(j);
        });

        document.body.innerHTML = "";
        const style = document.createElement("style");
        style.innerHTML = `
            .flag-critical { background-color: #f8d7da !important; }
            .flag-warning { background-color: #fff3cd !important; }
            .flag-closed { background-color: #e3f2fd !important; border-left: 5px solid #2196f3 !important; }
            .selected-row { background-color: #d1e7ff !important; font-weight: bold !important; }
            .copy-button-cell { width: 50px; text-align: right; }
            .delete-btn { background: #dc3545; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-top: 20px; }
            .delete-btn:hover { background: #c82333; }
        `;
        document.head.appendChild(style);

        const main = document.createElement("div");
        Object.assign(main.style, { position: "fixed", inset: "2em", padding: "20px", background: "white", border: "1px solid #ccc", borderRadius: "8px", display: "flex", flexDirection: "column", fontFamily: "Arial", zIndex: "9999" });

        const controls = document.createElement("div");
        Object.assign(controls.style, { position: "fixed", top: "2em", right: "2em", zIndex: "10000", display: "flex", gap: "10px", alignItems: "center" });
        
        const groupContainer = document.createElement("div");
        Object.assign(groupContainer.style, { background: "#f5f5f5", padding: "5px 10px", borderRadius: "5px", fontSize: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" });
        groupContainer.innerHTML = "<b>Group By: </b>";
        ["estimator", "supervisor", "foreman", "accountingPerson"].forEach(k => {
            if (COL_INDEX[k] === -1 && k !== "estimator") return;
            const l = document.createElement("label");
            l.style.marginRight = "10px";
            l.innerHTML = `<input type="radio" name="grp" value="${k}" ${k === groupByKey ? "checked" : ""}> ${k.charAt(0).toUpperCase() + k.slice(1)}`;
            l.onchange = (e) => renderDashboard(e.target.value, showClosed);
            groupContainer.appendChild(l);
        });

        const toggleLabel = document.createElement("label");
        Object.assign(toggleLabel.style, { background: "#2196f3", color: "white", padding: "5px 10px", borderRadius: "5px", fontSize: "12px", cursor: "pointer" });
        toggleLabel.innerHTML = `<input type="checkbox" ${showClosed ? "checked" : ""}> Show Closed`;
        toggleLabel.onchange = (e) => renderDashboard(groupByKey, e.target.checked);

        controls.appendChild(groupContainer);
        controls.appendChild(toggleLabel);
        document.body.appendChild(controls);

        const tabs = document.createElement("div");
        Object.assign(tabs.style, { display: "flex", borderBottom: "1px solid #ccc", marginBottom: "10px", overflowX: "auto" });
        main.appendChild(tabs);

        const content = document.createElement("div");
        Object.assign(content.style, { display: "flex", flex: "1", gap: "20px", overflow: "hidden" });
        main.appendChild(content);

        const listsWrapper = document.createElement("div");
        Object.assign(listsWrapper.style, { display: "flex", gap: "20px", flex: "2", overflow: "hidden" });
        content.appendChild(listsWrapper);

        const details = document.createElement("div");
        Object.assign(details.style, { flex: "1", overflowY: "auto", background: "#f5f5f5", padding: "15px", borderRadius: "5px" });
        details.innerHTML = "<p>Select a job to view details.</p>";
        content.appendChild(details);

        const groupNames = Object.keys(grouped).sort();
        groupNames.forEach(name => {
            const btn = document.createElement("button");
            btn.innerText = `${name} (${grouped[name].length})`;
            Object.assign(btn.style, { padding: "10px", border: "none", background: "none", cursor: "pointer" });
            
            const pane = document.createElement("div");
            Object.assign(pane.style, { display: "none", gap: "20px", flex: "1", width: "100%" });

            const dashList = document.createElement("div");
            Object.assign(dashList.style, { flex: "1", overflowY: "auto" });
            const dashTable = document.createElement("table");
            dashTable.style.width = "100%";

            const xactList = document.createElement("div");
            Object.assign(xactList.style, { flex: "1", overflowY: "auto" });
            const xactTable = document.createElement("table");
            xactTable.style.width = "100%";

            grouped[name].forEach(job => {
                const createRow = (table, cellsData) => {
                    const row = table.insertRow();
                    row.style.cursor = "pointer";
                    row.setAttribute("data-id", job.dash.text);
                    cellsData.forEach(c => {
                        c.background = job.rowFlagClass || c.background;
                        row.appendChild(createTableCell(c));
                    });
                    row.onclick = () => {
                        document.querySelectorAll(`tr[data-id="${job.dash.text}"]`).forEach(r => r.classList.add("selected-row"));
                        document.querySelectorAll(`tr:not([data-id="${job.dash.text}"])`).forEach(r => r.classList.remove("selected-row"));
                        showDetails(job, details, groupByKey, showClosed);
                    };
                };
                createRow(dashTable, [job.name, job.dash, job.copyJobNumber]);
                if (job.xa.text) createRow(xactTable, [job.name, job.xa]);
            });

            dashList.appendChild(dashTable);
            xactList.appendChild(xactTable);
            pane.appendChild(dashList);
            pane.appendChild(xactList);
            listsWrapper.appendChild(pane);

            btn.onclick = () => {
                [...tabs.children].forEach(b => b.style.borderBottom = "none");
                [...listsWrapper.children].forEach(p => p.style.display = "none");
                btn.style.borderBottom = "2px solid #2196f3";
                pane.style.display = "flex";
            };
            tabs.appendChild(btn);
        });

        document.body.appendChild(main);
        if (tabs.firstChild) tabs.firstChild.click();
    }

    function showDetails(job, panel, groupByKey, showClosed) {
        panel.innerHTML = `<h3>${job.name.text}</h3>`;
        const items = [
            {l: "Status", d: job.jobStatus},
            {l: "Estimates", d: job.estimates},
            {l: "Invoiced", d: job.invoiced},
            {l: "Collected", d: job.totalCollected},
            {l: "Last Note", d: job.journalDate}
        ];
        items.forEach(i => {
            const p = document.createElement("p");
            p.innerHTML = `<b>${i.l}:</b> ${i.d.text}`;
            if (i.d.background) { Object.assign(p.style, { background: i.d.background === CRITICAL_FLAG_CLASS ? "#f8d7da" : "#fff3cd", padding: "2px 5px", borderRadius: "3px" }); }
            panel.appendChild(p);
        });
        for (let k in job.other) {
            const p = document.createElement("p");
            p.innerHTML = `<b>${k}:</b> ${job.other[k].text}`;
            panel.appendChild(p);
        }

        const delBtn = document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.innerText = "❌ Delete Job from History";
        delBtn.onclick = () => {
            if(confirm(`Are you sure you want to remove job ${job.dash.text} from your local history?`)) {
                const currentData = getStoredData();
                const filtered = currentData.filter(j => j.dash.text !== job.dash.text);
                saveToStorage(filtered);
                window.finalScrapedData = filtered;
                renderDashboard(groupByKey, showClosed);
            }
        };
        panel.appendChild(delBtn);
    }
}();
