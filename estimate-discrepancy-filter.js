javascript:!function() {
    const STORAGE_KEY = "discrepancy_report_v2";

    /* --- HELPERS --- */
    const parseCurrency = (text) => {
        if (!text) return 0;
        // Removes $, commas, and handles accounting format (parentheses)
        const cleaned = text.replace(/[$, ]/g, "").replace(/\((.*)\)/, "-$1");
        return parseFloat(cleaned) || 0;
    };

    function createTableCell(cellData) {
        const td = document.createElement("td");
        td.style.padding = "10px 8px";
        td.style.borderBottom = "1px solid #ddd";
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

    /* --- SCRAPER --- */
    const headerRow = document.querySelector(".rgHeaderWrapper thead tr");
    if (!headerRow) return alert("Report header not found. Ensure the report is fully loaded.");

    const headerCells = [...headerRow.querySelectorAll("th")];
    const COL = {
        jobNum: headerCells.findIndex(c => c.textContent.trim() === "Job Number"),
        est: headerCells.findIndex(c => c.textContent.trim() === "Total Estimates"),
        status: headerCells.findIndex(c => c.textContent.trim() === "Job Status"),
        inv: headerCells.findIndex(c => c.textContent.trim() === "Invoiced Subtotal")
    };

    // Validation to ensure the column was actually found
    if (COL.inv === -1) return alert("Could not find 'Invoiced Subtotal' column. Please check your report view.");

    const scrapedJobs = [...document.querySelectorAll("tr.rgRow, tr.rgAltRow")].map(row => {
        const cells = row.querySelectorAll("td");
        const rawEst = cells[COL.est]?.textContent.trim() || "";
        const rawInv = cells[COL.inv]?.textContent.trim() || "";
        
        const valEst = parseCurrency(rawEst);
        const valInv = parseCurrency(rawInv);

        /* Logic: Not empty AND not equal (allowing for 1 cent rounding diff) */
        if (rawEst !== "" && Math.abs(valEst - valInv) > 0.01) {
            return {
                job: cells[COL.jobNum]?.textContent.trim(),
                url: cells[COL.jobNum].querySelector("a")?.href || "#",
                estimate: rawEst,
                invoice: rawInv,
                status: cells[COL.status]?.textContent.trim() || "N/A"
            };
        }
        return null;
    }).filter(Boolean);

    window.scrapedAccumulator = (window.scrapedAccumulator || []).concat(scrapedJobs);

    /* --- PAGING --- */
    const navPart = document.querySelector(".rgNumPart");
    const current = navPart?.querySelector(".rgCurrentPage");
    const next = current?.nextElementSibling;

    if (next && next.tagName === "A") {
        next.click();
    } else {
        renderDashboard(window.scrapedAccumulator);
    }

    /* --- UI --- */
    function renderDashboard(data) {
        document.body.innerHTML = "";
        document.title = "Discrepancy Dashboard";
        
        const main = document.createElement("div");
        Object.assign(main.style, { 
            position: "fixed", inset: "2em", padding: "25px", background: "white", 
            border: "1px solid #aaa", borderRadius: "12px", overflowY: "auto", 
            fontFamily: "system-ui, -apple-system, sans-serif", zIndex: "9999",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
        });

        const header = document.createElement("div");
        header.style.marginBottom = "20px";
        header.innerHTML = `
            <h2 style="margin:0">Discrepancy Report: ${data.length} Discrepancies Found</h2>
            <p style="color: #666; margin-top: 5px;">Showing jobs where <b>Total Estimates</b> is populated but does not match <b>Invoiced Subtotal</b>.</p>
        `;
        main.appendChild(header);

        const table = document.createElement("table");
        table.style.width = "100%";
        table.style.borderCollapse = "collapse";
        table.innerHTML = `
            <tr style="background: #f8f9fa; text-align: left; border-bottom: 2px solid #dee2e6;">
                <th style="padding: 12px 8px;">Job Number</th>
                <th style="padding: 12px 8px;">Status</th>
                <th style="padding: 12px 8px;">Total Estimates</th>
                <th style="padding: 12px 8px;">Invoiced Subtotal</th>
            </tr>
        `;

        data.forEach(item => {
            const row = document.createElement("tr");
            row.appendChild(createTableCell({ text: item.job, url: item.url }));
            row.appendChild(createTableCell({ text: item.status }));
            row.appendChild(createTableCell({ text: item.estimate }));
            row.appendChild(createTableCell({ text: item.invoice }));
            table.appendChild(row);
        });

        main.appendChild(table);

        const actions = document.createElement("div");
        actions.style.marginTop = "30px";
        
        const closeBtn = document.createElement("button");
        closeBtn.innerText = "← Return to CRM";
        closeBtn.onclick = () => location.reload();
        closeBtn.style.cssText = "padding: 10px 20px; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px; font-weight: bold;";
        
        actions.appendChild(closeBtn);
        main.appendChild(actions);

        document.body.appendChild(main);
    }
}();
