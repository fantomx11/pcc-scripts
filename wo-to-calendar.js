(async (devMode = false) => {
  const baseUrl = devMode ? "https://fantomx11.github.io/pcc-scripts/dev" : "https://fantomx11.github.io/pcc-scripts";

  const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbyOLQC7nZm0UewXyxkj4M2RJRhqlg9r_XUa0CfDpPCTQnUSeEQv19VpZTVhzXzirzbczg/exec"

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
    const [syncReport, setSyncReport] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleDownloadICS = () => {
      const icsContent = Exporter.generateICS(data);
      Exporter.downloadFile(icsContent, "WorkOrders.ics");
    };


    const handleCloudSync = async () => {
      setIsSyncing(true);
      // Fires your detached standalone fetch execution pipeline string
      const result = await sendDataToGoogleCalendar(data);
      setIsSyncing(false);

      if (result) {
        // Mounts your fresh SyncStatusModal structure over the view by saving data to state
        setSyncReport(result);
      }
    };

    let minDate = new Date();
    let maxDate = new Date();
    data.forEach((ev, i) => {
      const s = new Date(ev.start);
      const e = new Date(ev.end);
      if (i === 0 || s < minDate) minDate = new Date(s);
      if (i === 0 || e > maxDate) maxDate = new Date(e);
    });

    if (isNaN(minDate) || isNaN(maxDate)) {
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
            <button class="btn btn-cloud" onClick=${handleCloudSync} disabled=${isSyncing} style="background: #1a73e8; color: white;">
              ${isSyncing ? "Syncing..." : "Sync to Google & Outlook"}
            </button>
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
        ${syncReport ? html`
          <${SyncStatusModal} 
            summaryReport=${syncReport} 
            onClose=${() => setSyncReport(null)} 
          />
        ` : ''}
      </div>
    `;
  };

  function getActiveJobMetadata() {
    // Query only the grey link tracking elements within the active panel
    const primaryLink = document.querySelector("#ctl00_divLastView a.MS_grey_12");

    if (!primaryLink) {
      return { jobNumber: "", customerName: "Unknown Customer" };
    }

    const rawText = primaryLink.textContent.trim(); // e.g., "26-0063-STR, Jarvis, Brandon"
    const parts = rawText.split(",");

    // The first segment before the comma is always the Job Number
    const jobNumber = parts[0] ? parts[0].trim() : "";

    // Everything following the first comma is the Customer Name
    const customerName = parts.length > 1 ? parts.slice(1).join(",").trim() : "Unknown Customer";

    return {
      jobNumber: jobNumber,
      customerName: customerName
    };
  }

  async function sendDataToGoogleCalendar(events) {
    const jobData = getActiveJobMetadata();

    console.log(events);

    return await fetch(GOOGLE_API_URL, {
      method: "post",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({ jobData, events })
    }).then(r => r.json());
  }

  const SyncStatusModal = ({ summaryReport, onClose }) => {
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summaryReport.url)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
      } else {
        // Fallback mechanism for legacy browser page layers
        const textArea = document.createElement("textarea");
        textArea.value = summaryReport.url;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) { }
        document.body.removeChild(textArea);
      }
    };

    const hasFailures = summaryReport.summary?.failedCount > 0;

    return html`
    <div class="status-modal-overlay" onClick=${(e) => e.target.className === 'status-modal-overlay' && onClose()}>
      <style>
        .status-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          z-index: 100000; /* Ensure it floats completely on top of the main calendar card */
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          font-family: "Segoe UI", sans-serif;
        }
        .status-modal-content {
          background: white;
          width: 100%;
          max-width: 550px;
          border-radius: 8px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .status-header {
          padding: 16px 20px;
          border-bottom: 1px solid #eef2f5;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .status-header h3 { margin: 0; color: #1a73e8; font-size: 16px; }
        .status-body { padding: 20px; overflow-y: auto; max-height: 70vh; }
        .stat-badge-group { display: flex; gap: 10px; margin-bottom: 15px; }
        .stat-badge { font-size: 11px; font-weight: bold; padding: 4px 8px; border-radius: 4px; background: #f1f3f4; color: #5f6368; }
        .stat-badge.success { background: #e6f4ea; color: #137333; }
        .stat-badge.failure { background: #fce8e6; color: #c5221f; }
        
        .copy-link-box {
          display: flex;
          gap: 5px;
          background: #f8f9fa;
          border: 1px solid #dadce0;
          border-radius: 4px;
          padding: 8px;
          margin-bottom: 15px;
          align-items: center;
        }
        .copy-link-box input { flex: 1; border: none; background: transparent; font-size: 11px; color: #3c4043; outline: none; }
        .btn-copy { background: #1a73e8; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: bold; cursor: pointer; white-space: nowrap; }
        .btn-copy.copied { background: #34a853; }
        
        .instructions-panel { background: #f8f9fa; border-left: 4px solid #1a73e8; padding: 12px; border-radius: 0 4px 4px 0; font-size: 12px; margin-bottom: 15px; }
        .instructions-panel ol { margin: 6px 0 0 18px; padding: 0; }
        .instructions-panel li { margin-bottom: 4px; color: #3c4043; }
        
        .failure-log-box { border: 1px solid #f5c2c2; background: #fff5f5; border-radius: 4px; padding: 12px; font-size: 11px; }
        .failure-log-box h4 { margin: 0 0 8px 0; color: #c5221f; font-size: 12px; }
        .failure-list { max-height: 120px; overflow-y: auto; margin: 0; padding-left: 15px; }
        .failure-list li { margin-bottom: 4px; color: #601210; }
        
        .status-footer { padding: 12px 20px; border-top: 1px solid #eef2f5; display: flex; justify-content: flex-end; background: #f8f9fa; }
        .btn-done { background: #3c4043; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; }
      </style>

      <div class="status-modal-content">
        <div class="status-header">
          <h3>Google Calendar Sync Report</h3>
        </div>
        
        <div class="status-body">
          <div class="stat-badge-group">
            <span class="stat-badge success">Synced: ${summaryReport.summary?.successfulCount || 0}</span>
            ${hasFailures ? html`<span class="stat-badge failure">Failed: ${summaryReport.summary.failedCount}</span>` : ''}
          </div>

          <label style="display:block; font-size:11px; font-weight:bold; color:#5f6368; margin-bottom:4px;">Outlook Subscription Link:</label>
          <div class="copy-link-box">
            <input type="text" value=${summaryReport.url} readonly onClick=${(e) => e.target.select()} />
            <button class="btn-copy ${copied ? 'copied' : ''}" onClick=${handleCopyLink}>
              ${copied ? "Copied!" : "Copy Link"}
            </button>
          </div>

          <div class="instructions-panel">
            <strong>How to add to Outlook Desktop / Web:</strong>
            <ol>
              <li>Copy the subscription link generated above.</li>
              <li>Open Outlook and navigate to your <strong>Calendar view</strong>.</li>
              <li>Click <strong>Add Calendar</strong> (or right-click 'Other Calendars') and select <strong>From Internet</strong> (or 'Subscribe from web').</li>
              <li>Paste the link into the URL field and click <strong>OK / Save</strong>.</li>
            </ol>
          </div>

          ${hasFailures ? html`
            <div class="failure-log-box">
              <h4>⚠️ Failed Work Orders (${summaryReport.summary.failedCount})</h4>
              <ul class="failure-list">
                ${summaryReport.summary.failures.map((f, idx) => html`
                  <key val=${idx}>
                    <li><strong>${f.wo}</strong>: ${f.summary} <br/><span style="opacity:0.85; font-style:italic;">(${f.error})</span></li>
                  </key>
                `)}
              </ul>
            </div>
          ` : ''}
        </div>

        <div class="status-footer">
          <button class="btn-done" onClick=${onClose}>Dismiss</button>
        </div>
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