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
                const start = cells[indices.start]?.innerText.trim().split(' ')[0];
                const end = cells[indices.end]?.innerText.trim().split(' ')[0];

                if (wo && start && start !== '---' && !existing.has(wo)) {
                    data.push({ wo, summary: cells[indices.summary]?.innerText.trim(), start, end });
                }
            });
            State.set(data);
            return data.length;
        }
    };

    const Pagination = {
        info: () => {
            const info = document.querySelector('.rgInfoPart');
            if (!info) return { isLast: true };
            const match = info.innerText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
            return match ? { isLast: parseInt(match[1]) >= parseInt(match[2]) } : { isLast: true };
        },
        advance: () => document.querySelector('input.rgPageNext')?.click()
    };

    const UI = {
        showOverlay: (count) => {
            let el = document.getElementById(CONFIG.OVERLAY_ID) || document.createElement('div');
            el.id = CONFIG.OVERLAY_ID;
            el.style = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10001;padding:20px;background:#1a73e8;color:white;border-radius:12px;font-family:sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.3);text-align:center;min-width:250px;';
            el.innerHTML = `<h3>Scraping...</h3><div style="font-size:22px;font-weight:bold;">${count} Items</div><p>Advancing... Click bookmark when loaded.</p>`;
            if (!el.parentElement) document.body.appendChild(el);
        },

        getStyles: () => `
            <style>
                body { font-family: "Segoe UI", Roboto, sans-serif; padding: 30px; background: #f0f2f5; color: #3c4043; }
                .month-box { background: white; padding: 30px; border-radius: 12px; margin-bottom: 50px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); page-break-after: always; }
                h2 { text-align: center; color: #1a73e8; margin-top: 0; border-bottom: 2px solid #e8f0fe; padding-bottom: 15px; }
                .grid { display: grid; grid-template-columns: repeat(7, 1fr); border-top: 1px solid #dadce0; border-left: 1px solid #dadce0; }
                .day-h { background: #f8f9fa; padding: 12px; text-align: center; font-weight: 600; border-right: 1px solid #dadce0; border-bottom: 3px solid #1a73e8; font-size: 13px; text-transform: uppercase; color: #70757a; }
                .day-c { min-height: 140px; border-right: 1px solid #dadce0; border-bottom: 1px solid #dadce0; padding: 8px; position: relative; background: #fff; }
                .d-num { font-weight: 700; color: #dadce0; font-size: 16px; display: block; margin-bottom: 8px; }
                .ev-box { font-size: 11px; background: #e8f0fe; border-left: 4px solid #1a73e8; padding: 6px; margin-top: 6px; border-radius: 4px; line-height: 1.4; color: #1967d2; }
                .empty { background: #f1f3f4; }
                @media print { body { background: white; padding: 0; } .month-box { box-shadow: none; border: 1px solid #eee; } }
            </style>`,

        renderCalendar: (data) => {
            const policy = (window.trustedTypes?.createPolicy) ? 
                window.trustedTypes.createPolicy('calendarPolicy', { createHTML: (h) => h }) : { createHTML: (s) => s };
            
            const months = {};
            data.forEach(ev => {
                const d = new Date(ev.start);
                const key = `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
                if (!months[key]) months[key] = [];
                months[key].push(ev);
            });

            let html = UI.getStyles();
            Object.keys(months).sort((a,b) => new Date(a) - new Date(b)).forEach(mKey => {
                const [mName, year] = mKey.split(' ');
                const first = new Date(mName + " 1, " + year);
                const offset = first.getDay();
                const daysInMonth = new Date(year, first.getMonth() + 1, 0).getDate();

                html += `<div class="month-box"><h2>${mKey}</h2><div class="grid">`;
                ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => html += `<div class="day-h">${d}</div>`);
                for(let i=0; i<offset; i++) html += `<div class="day-c empty"></div>`;
                for(let d=1; d<=daysInMonth; d++) {
                    const cur = new Date(year, first.getMonth(), d);
                    html += `<div class="day-c"><span class="d-num">${d}</span>`;
                    data.forEach(ev => {
                        if (cur >= new Date(ev.start) && cur <= new Date(ev.end)) {
                            html += `<div class="ev-box">${ev.summary}</div>`;
                        }
                    });
                    html += `</div>`;
                }
                html += `</div></div>`;
            });

            const win = window.open('', '_blank', 'width=1200,height=900');
            win.document.body.innerHTML = policy.createHTML(html);
        }
    };

    /* Main Execution Flow */
    const indices = Scraper.getIndices();
    if (!indices) return alert('Required columns not found.');

    const count = Scraper.parsePage(indices);
    const pg = Pagination.info();

    if (!pg.isLast) {
        UI.showOverlay(count);
        Pagination.advance();
    } else {
        const finalData = State.get();
        State.clear();
        document.getElementById(CONFIG.OVERLAY_ID)?.remove();
        if (finalData.length) UI.renderCalendar(finalData);
        else alert('No data collected.');
    }
})();
