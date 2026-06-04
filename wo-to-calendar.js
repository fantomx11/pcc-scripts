(async (devMode = false) => {
  const baseUrl = devMode ? "https://fantomx11.github.io/pcc-scripts/dev" : "https://fantomx11.github.io/pcc-scripts";

  const App = window.App = window.App || {};

  const { html } = await import(`${baseUrl}/modules/lib.js`);
  const { Scraper } = await import(`${baseUrl}/classes/Scraper.js`);
  const { h, render } = await import('https://esm.sh/preact');
  const { useState, useEffect } = await import('https://esm.sh/preact/hooks');

  const COLUMN_MAPPINGS = {
    "Number": "wo",
    "Summary": "summary",
    "Estimated Start Date": "start",
    "Estimated End Date": "end"
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
        const endD = new Date(ev.end);
        endD.setDate(endD.getDate() + 1); // ICS end dates are exclusive for all-day boundaries
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

  const CalendarModalApp = ({ initialData, onClose, baseUrl }) => {
    const [data] = useState(initialData);

    const handleDownloadICS = () => {
      const icsContent = Exporter.generateICS(data);
      Exporter.downloadFile(icsContent, "WorkOrders.ics");
    };

    let minDate = new Date();
    let maxDate = new Date();
    data.forEach((ev, i) => {
        const s = new Date(ev.start);
        const e = new Date(ev.end);
        if (i === 0 || s < minDate) minDate = new Date(s);
        if (i === 0 || e > maxDate) maxDate = new Date(e);
    });

    if(isNaN(minDate) || isNaN(maxDate)) {
      return html`<div>No work orders have calendar data.</div>`;
    }

    const monthsToRender = [];

    let currentTrack = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (currentTrack <= maxDate) {
      monthsToRender.push(new Date(currentTrack));
      currentTrack.setMonth(currentTrack.getMonth() + 1);
    }

    return html`
      <div class="calendar-modal-overlay" onClick=${(e) => e.target.className === 'calendar-modal-overlay' && onClose()}>
        <div class="calendar-modal-content" onClick=${(e) => e.stopPropagation()}>
          <div class="toolbar">
            <button class="btn btn-ics" onClick=${handleDownloadICS}>Download .ICS for Outlook/Google</button>
            <button class="btn btn-close" onClick=${onClose} style="background: #333; color: white;">Close Calendar</button>
          </div>

          ${monthsToRender.map(monthDate => {
            const year = monthDate.getFullYear();
            const monthIdx = monthDate.getMonth();
            const mName = monthDate.toLocaleString('default', { month: 'long' });

            const first = new Date(year, monthIdx, 1);
            const offset = first.getDay();
            const daysInMonth = new Date(year, first.getMonth() + 1, 0).getDate();

            // Build background filler cells for offset days
            const blanks = Array.from({ length: offset });
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

            return html`
              <div class="month-box" key=${`${year}-${monthIdx}`}>
                <h2>${mName}</h2>
                <div class="grid">
                  ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => html`<div class="day-h">${d}</div>`)}
                  ${blanks.map((_, idx) => html`<div class="day-c" key=${`b-${idx}`} style="background:#f9f9f9"></div>`)}
                  ${days.map(d => {
                    const cur = new Date(year, monthIdx, d);
                    return html`
                      <div class="day-c" key=${`d-${d}`}>
                        <span class="d-num">${d}</span>
                        ${data.filter(ev => cur >= new Date(ev.start) && cur <= new Date(ev.end)).map((ev, evIdx) => html`
                          <div class="ev-box" key=${evIdx}>
                            <br />${ev.summary}
                          </div>
                        `)}
                      </div>
                    `;
                  })}
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  };

  const customRowMapper = {};
  Object.keys(COLUMN_MAPPINGS).forEach(headerText => {
    const targetProperty = COLUMN_MAPPINGS[headerText];
    customRowMapper[headerText] = (cell) => ({ [targetProperty]: cell.textContent.trim() });
  });

  const scraper = new Scraper({
    rowMapper: customRowMapper,
    SELECTORS: {
      HEADER: ".rgHeaderRow, .rgMasterTable thead tr:not(.rgFilterRow):not(.rgCommandRow)",
      ROWS: "tr.rgRow, tr.rgAltRow",
      PAGER: ".rgNumPart .rgCurrentPage"
    }
  });

  App.init = async function init() {
    console.log("Initializing Work Order background fetch...");
    const rawData = await scraper.scrape(); //
    const cleanData = rawData.filter(d => d.wo && d.start && d.start !== '---');

    if (!cleanData.length) {
      return alert("Columns not found or table dataset is empty.");
    }

    const style = document.head.appendChild(document.createElement("link"));
    style.href = `${baseUrl}/styles/wo-to-calendar.css`;
    style.rel = "stylesheet";

    // 1. Create a dedicated overlay container without clearing document.body
    const modalTarget = document.createElement('div');
    modalTarget.id = "calendar-modal-root";
    document.body.appendChild(modalTarget);

    // 2. Define the self-destruct function passed to Preact
    const handleClose = () => {
      render(null, modalTarget); // Safely unmounts Preact virtual tree and event listeners
      modalTarget.remove();      // Removes container element from live DOM, restoring host UI
    };

    // 3. Render the application onto the isolated overlay node
    render(
      html`<${CalendarModalApp} initialData=${cleanData} onClose=${handleClose} baseUrl=${baseUrl} />`, 
      modalTarget
    );
  };

  App.init();
})();
