javascript:!function() {
    const STORAGE_KEY = "discrepancy_report_v5";

    const parseCurrency = (text) => {
        if (!text) return 0;
        const cleaned = text.replace(/[$, ]/g, "").replace(/\((.*)\)/, "-$1");
        return parseFloat(cleaned) || 0;
    };

    function createTableCell(cellData) {
        const td = document.createElement("td");
        td.style.padding = "10px 8px";
        td.style.borderBottom = "1px solid rgba(0,0,0,0.05)";
        if (cellData.bold) td.style.fontWeight = "bold";

        if (cellData.url) {
            const a = document.createElement("a");
            a.href = cellData.url;
            a.target = "_blank";
            a.innerText = cellData.text;
            a.style.fontWeight = "bold";
            a.style.color = "#0056b3";
            td.appendChild(a);
        } else {
            td.innerText = cellData.text;
        }
        return td;
    }

    const headerRow = document.querySelector(".rgHeaderWrapper thead tr");
    if (!headerRow) return alert("Report header not found.");

    const headerCells = [...headerRow.querySelectorAll("th")];
    const COL = {
        jobNum: headerCells.findIndex(c => c.textContent.trim() === "Job Number"),
        est: headerCells.findIndex(c => c.textContent.trim() === "Total Estimates"),
        status: headerCells.findIndex(c => c.textContent.trim() === "Job Status"),
        inv: headerCells.findIndex(c => c.textContent.trim() === "Invoiced Subtotal")
    };

    const scrapedJobs = [...document.querySelectorAll("tr.rgRow, tr.rgAltRow")].map(row => {
        const cells = row.querySelectorAll("td");
        const rawEst = cells[COL.est]?.textContent.trim() || "";
        const rawInv = cells[COL.inv]?.textContent.trim() || "";
        
        const valEst = parseCurrency(rawEst);
        const valInv = parseCurrency(rawInv);
        const diff = valEst - valInv;

        if (rawEst !== "" && Math.abs(diff) > 0.01) {
            return {
                job: cells[COL.jobNum]?.textContent.trim(),
                url: cells[COL.jobNum].querySelector("a")?.href || "#",
                estimate: rawEst,
                invoice: rawInv,
                difference: diff,
                absDiff: Math.abs(diff),
                status: cells[COL.status]?.textContent.trim() || "N/A"
            };
        }
        return null;
    }).filter(Boolean);

    window.scrapedAccumulator = (window.scrapedAccumulator || []).concat(scrapedJobs);

    const navPart = document.querySelector(".rgNumPart");
    const current = navPart?.querySelector(".rgCurrentPage");
    const next = current?.nextElementSibling;

    if (next && next.tagName === "A") {
        next.click();
    } else {
        const sortedData = window.scrapedAccumulator.sort((a, b) => b.absDiff - a.absDiff);
        renderDashboard(sortedData);
    }

    function renderDashboard(data) {
        document.body.innerHTML = "";
        
        const main = document.createElement("div");
        Object.assign(main.style, { 
            position: "fixed", inset: "2em", padding: "25px", background: "white", 
            border: "1px solid #aaa", borderRadius: "12px", overflowY: "auto", 
            fontFamily: "system-ui, sans-serif", zIndex: "9999", boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
        });

        /* --- SUMMARY CALCULATIONS --- */
        const totalUnder = data.filter(i => i.difference > 0).reduce((sum, i) => sum + i.difference, 0);
        const totalOver = data.filter(i => i.difference < 0).reduce((sum, i) => sum + i.difference, 0);

        const header = document.createElement("div");
        header.style.marginBottom = "20px";
        header.innerHTML = `
            <h2 style="margin:0">Discrepancy Report: ${data.length} Items</h2>
            <div style="display:flex; gap:20px; margin-top:10px; font-weight:bold;">
                <span style="color:#1e7e34">Total Unbilled Estimate: ${totalUnder.toLocaleString('en-US', {style:'currency', currency:'USD'})}</span>
                <span style="color:#bd2130">Total Over-Invoiced: ${Math.abs(totalOver).toLocaleString('en-US', {style:'currency', currency:'USD'})}</span>
            </div>
        `;
        main.appendChild(header);

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "separate";
        table.style.borderSpacing = "0 4px"; 
        table.innerHTML = `
            <tr style="background: #f8f9fa; text-align: left;">
                <th style="padding: 12px 8px;">Job Number</th>
                <th style="padding: 12px 8px;">Status</th>
                <th style="padding: 12px 8px;">Total Estimates</th>
                <th style="padding: 12px 8px;">Invoiced Subtotal</th>
                <th style="padding: 12px 8px;">Difference</th>
            </tr>
        `;

        data.forEach(item => {
            const row = document.createElement("tr");
            
            /* Background Coloring Logic */
            const isNegative = item.difference < 0;
            row.style.backgroundColor = isNegative ? "#fff5f5" : "#f6fff6";
            
            row.appendChild(createTableCell({ text: item.job, url: item.url }));
            row.appendChild(createTableCell({ text: item.status }));
            row.appendChild(createTableCell({ text: item.estimate }));
            row.appendChild(createTableCell({ text: item.invoice }));
            
            const diffText = (item.difference > 0 ? "+" : "") + item.difference.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
            row.appendChild(createTableCell({ 
                text: diffText, 
                bold: true 
            }));
            
            table.appendChild(row);
        });

        main.appendChild(table);

        const closeBtn = document.createElement("button");
        closeBtn.innerText = "Close & Refresh CRM";
        closeBtn.onclick = () => location.reload();
        closeBtn.style.cssText = "margin-top: 20px; padding: 10px 24px; cursor: pointer; background: #333; color: white; border: none; border-radius: 6px; font-weight: 600;";
        main.appendChild(closeBtn);

        document.body.appendChild(main);
    }
}();
