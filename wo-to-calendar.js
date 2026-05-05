(function(){
    const CONFIG = {
        STORAGE_KEY: 'WO_CALENDAR_DATA',
        OVERLAY_ID: 'wo-scraper-status',
        COLUMN_MAP: {
            wo: 'Number',
            summary: 'Summary',
            start: 'Estimated Start Date',
            end: 'Estimated End Date'
        }
    };

    const State = {
        get: () => window[CONFIG.STORAGE_KEY] || [],
        set: (data) => window[CONFIG.STORAGE_KEY] = data,
        clear: () => delete window[CONFIG.STORAGE_KEY]
    };

    const Scraper = {
        getIndices: () => {
            const headerRow = document.querySelector('.rgHeaderRow') || 
                              document.querySelector('.rgMasterTable thead tr:not(.rgFilterRow):not(.rgCommandRow)');
            if (!headerRow) return null;
            const headers = Array.from(headerRow.querySelectorAll('th, td'));
            const map = {};
            for (let key in CONFIG.COLUMN_MAP) {
                map[key] = headers.findIndex(h => h.innerText.trim().includes(CONFIG.COLUMN_MAP[key]));
            }
            return (map.wo !== -1 && map.start !== -1) ? map : null;
        },
        parsePage: (indices) => {
            const data = State.get();
            const existing = new Set(data.map(d => d.wo));
            document.querySelectorAll('.rgRow, .rgAltRow').forEach(row => {
                const cells = row.querySelectorAll('td');
                const wo = cells[indices.wo]?.innerText.trim();
                const start = cells[indices.start]?.innerText.trim();
                const end = cells[indices.end]?.innerText.trim();
                if (wo && start && start !== '---' && !existing.has(wo)) {
                    data.push({ wo, summary: cells[indices.summary]?.innerText.trim(), start, end });
                }
            });
            State.set(data);
            return data.length;
        }
    };

    const Exporter = {
        formatDate: (dateStr) => {
            const d = new Date(dateStr);
            return d.toISOString().replace(/-|:|\.\d+/g, '').split('T')[0] + 'T090000';
        },
        generateICS: (data) => {
            let ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gemini//WorkOrderCalendar//EN'];
            data.forEach(ev => {
                ics.push('BEGIN:VEVENT');
                ics.push(`SUMMARY:${ev.summary}`);
                ics.push(`DTSTART;VALUE=DATE:${Exporter.formatDate(ev.start).split('T')[0]}`);
                /* ICS end dates are exclusive, so we add 1 day if it's an all-day event */
                const endD = new Date(ev.end);
                endD.setDate(endD.getDate() + 1);
                ics.push(`DTEND;VALUE=DATE:${endD.toISOString().replace(/-|:|\.\d+/g, '').split('T')[0]}`);
                ics.push('END:VEVENT');
            });
            ics.push('END:VCALENDAR');
            return ics.join('\n');
        },
        downloadFile: (content, filename) => {
            const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }
    };

    const UI = {
        showOverlay: (count) => {
            let el = document.getElementById(CONFIG.OVERLAY_ID) || document.createElement('div');
            el.id = CONFIG.OVERLAY_ID;
            el.style = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10001;padding:20px;background:#1a73e8;color:white;border-radius:12px;font-family:sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.3);text-align:center;min-width:250px;';
            el.innerHTML = `<h3>Scraping...</h3><div style="font-size:22px;font-weight:bold;">${count} Items</div><p>Advancing... Click bookmark when loaded.</p>`;
            if (!el.parentElement) document.body.appendChild(el);
        },
        getStyles: () => `<style>
            body { font-family: "Segoe UI", sans-serif; padding: 30px; background: #f0f2f5; }
            .toolbar { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; }
            .btn { padding: 10px 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
            .btn-ics { background: #34a853; color: white; }
            .btn-print { background: #1a73e8; color: white; }
            .month-box { background: white; padding: 30px; border-radius: 12px; margin-bottom: 50px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); page-break-after: always; }
            h2 { text-align: center; color: #1a73e8; margin-top: 0; }
            .grid { display: grid; grid-template-columns: repeat(7, 1fr); border-top: 1px solid #dadce0; border-left: 1px solid #dadce0; }
            .day-h { background: #f8f9fa; padding: 12px; text-align: center; font-weight: 600; border-right: 1px solid #dadce0; border-bottom: 3px solid #1a73e8; }
            .day-c { min-height: 120px; border-right: 1px solid #dadce0; border-bottom: 1px solid #dadce0; padding: 8px; background: #fff; }
            .d-num { font-weight: 700; color: #dadce0; font-size: 16px; }
            .ev-box { font-size: 10px; background: #e8f0fe; border-left: 4px solid #1a73e8; padding: 4px; margin-top: 5px; border-radius: 4px; color: #1967d2; }
            @media print { .toolbar { display: none; } body { background: white; padding: 0; } }
        </style>`,
        render: (data) => {
            const policy = (window.trustedTypes?.createPolicy) ? 
                window.trustedTypes.createPolicy('calendarPolicy', { createHTML: (h) => h }) : { createHTML: (s) => s };
            
            const months = {};
            data.forEach(ev => {
                const d = new Date(ev.start);
                const key = `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
                if (!months[key]) months[key] = [];
                months[key].push(ev);
            });

            let html = UI.getStyles() + `<div class="toolbar">
                <button class="btn btn-print" onclick="window.print()">Print Calendar</button>
                <button id="download-ics" class="btn btn-ics">Download .ICS for Outlook/Google</button>
            </div>`;

            Object.keys(months).sort((a,b) => new Date(a) - new Date(b)).forEach(mKey => {
                const [mName, year] = mKey.split(' ');
                const first = new Date(mName + " 1, " + year);
                const offset = first.getDay();
                const daysInMonth = new Date(year, first.getMonth() + 1, 0).getDate();
                html += `<div class="month-box"><h2>${mKey}</h2><div class="grid">`;
                ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => html += `<div class="day-h">${d}</div>`);
                for(let i=0; i<offset; i++) html += `<div class="day-c" style="background:#f9f9f9"></div>`;
                for(let d=1; d<=daysInMonth; d++) {
                    const cur = new Date(year, first.getMonth(), d);
                    html += `<div class="day-c"><span class="d-num">${d}</span>`;
                    data.forEach(ev => {
                        if (cur >= new Date(ev.start) && cur <= new Date(ev.end)) 
                            html += `<div class="ev-box"><br>${ev.summary}</div>`;
                    });
                    html += `</div>`;
                }
                html += `</div></div>`;
            });

            const win = window.open('', '_blank', 'width=1200,height=900');
            win.document.body.innerHTML = policy.createHTML(html);
            
            /* Add ICS download event listener to the new window */
            win.document.getElementById('download-ics').onclick = () => {
                const icsContent = Exporter.generateICS(data);
                Exporter.downloadFile(icsContent, 'WorkOrders.ics');
            };
        }
    };

    /* Execution */
    const indices = Scraper.getIndices();
    if (!indices) return alert('Columns not found.');
    const count = Scraper.parsePage(indices);
    const pg = (document.querySelector('.rgInfoPart')?.innerText.match(/Page\s+(\d+)\s+of\s+(\d+)/i)) || [0,1,1];

    if (parseInt(pg[1]) < parseInt(pg[2])) {
        UI.showOverlay(count);
        document.querySelector('input.rgPageNext')?.click();
    } else {
        const finalData = State.get();
        State.clear();
        document.getElementById(CONFIG.OVERLAY_ID)?.remove();
        if (finalData.length) UI.render(finalData);
    }
})();
