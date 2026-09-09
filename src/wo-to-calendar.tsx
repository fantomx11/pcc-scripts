import { render } from 'preact';
import { useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';

// Styles inlined into the single IIFE output
import './styles/wo-to-calendar.css';

import { Scraper } from './classes/Scraper';
import { copyTextToClipboard } from './modules/lib';

const GOOGLE_API_URL =
  'https://script.google.com/macros/s/AKfycbyOLQC7nZm0UewXyxkj4M2RJRhqlg9r_XUa0CfDpPCTQnUSeEQv19VpZTVhzXzirzbczg/exec';

const COLUMN_MAPPINGS: Record<string, string> = {
  Number: 'wo',
  Summary: 'summary',
  'Estimated Start Date': 'start',
  'Estimated End Date': 'end',
};

export interface WorkOrder {
  wo: string;
  summary: string;
  start: string;
  end: string;
  [key: string]: unknown;
}

export interface SyncFailure {
  wo: string;
  summary: string;
  error: string;
}

export interface SyncReport {
  url: string;
  summary?: {
    successfulCount?: number;
    failedCount?: number;
    failures?: SyncFailure[];
  };
}

const Exporter = {
  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toISOString().replace(/-|:|\.\d+/g, '').split('T')[0] + 'T090000';
  },

  generateICS(data: WorkOrder[]): string {
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PCC//WorkOrderCalendar//EN'];
    data.forEach((ev) => {
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

  downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  },
};

function getActiveJobMetadata(): { jobNumber: string; customerName: string } {
  const primaryLink = document.querySelector<HTMLAnchorElement>('#ctl00_divLastView a.MS_grey_12');
  if (!primaryLink) {
    return { jobNumber: '', customerName: 'Unknown Customer' };
  }

  const rawText = primaryLink.textContent?.trim() || '';
  const parts = rawText.split(',');
  const jobNumber = parts[0] ? parts[0].trim() : '';
  const customerName = parts.length > 1 ? parts.slice(1).join(',').trim() : 'Unknown Customer';

  return { jobNumber, customerName };
}

async function sendDataToGoogleCalendar(events: WorkOrder[]): Promise<SyncReport> {
  const jobData = getActiveJobMetadata();
  const response = await fetch(GOOGLE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ jobData, events }),
  });
  return await response.json();
}

interface SyncStatusModalProps {
  summaryReport: SyncReport;
  onClose: () => void;
}

const SyncStatusModal: FunctionalComponent<SyncStatusModalProps> = ({ summaryReport, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    copyTextToClipboard(summaryReport.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasFailures = (summaryReport.summary?.failedCount || 0) > 0;

  return (
    <div
      class="status-modal-overlay"
      onClick={(e) => (e.target as HTMLElement).className === 'status-modal-overlay' && onClose()}
    >
      <div class="status-modal-content">
        <div class="status-header">
          <h3>Google Calendar Sync Report</h3>
        </div>

        <div class="status-body">
          <div class="stat-badge-group">
            <span class="stat-badge success">
              Synced: {summaryReport.summary?.successfulCount || 0}
            </span>
            {hasFailures && (
              <span class="stat-badge failure">
                Failed: {summaryReport.summary?.failedCount}
              </span>
            )}
          </div>

          <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#5f6368', marginBottom: '4px' }}>
            Outlook Subscription Link:
          </label>
          <div class="copy-link-box">
            <input
              type="text"
              value={summaryReport.url}
              readonly
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              class={`btn-copy ${copied ? 'copied' : ''}`.trim()}
              onClick={handleCopyLink}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <div class="instructions-panel">
            <strong>How to add to Outlook Desktop / Web:</strong>
            <ol>
              <li>Copy the subscription link generated above.</li>
              <li>Open Outlook and navigate to your <strong>Calendar view</strong>.</li>
              <li>Click <strong>Add Calendar</strong> (or right-click 'Other Calendars') and select <strong>From Internet</strong>.</li>
              <li>Paste the link into the URL field and click <strong>OK / Save</strong>.</li>
            </ol>
          </div>

          {hasFailures && (
            <div class="failure-log-box">
              <h4>⚠️ Failed Work Orders ({summaryReport.summary?.failedCount})</h4>
              <ul class="failure-list">
                {summaryReport.summary?.failures?.map((f, idx) => (
                  <li key={idx}>
                    <strong>{f.wo}</strong>: {f.summary} <br />
                    <span style={{ opacity: 0.85, fontStyle: 'italic' }}>({f.error})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div class="status-footer">
          <button type="button" class="btn-done" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

interface CalendarModalAppProps {
  initialData: WorkOrder[];
  onClose: () => void;
}

const CalendarModalApp: FunctionalComponent<CalendarModalAppProps> = ({ initialData, onClose }) => {
  const [data] = useState<WorkOrder[]>(initialData);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleDownloadICS = () => {
    const icsContent = Exporter.generateICS(data);
    Exporter.downloadFile(icsContent, 'WorkOrders.ics');
  };

  const handleCloudSync = async () => {
    setIsSyncing(true);
    try {
      const result = await sendDataToGoogleCalendar(data);
      if (result) {
        setSyncReport(result);
      }
    } catch (err) {
      console.error('Failed to sync to calendar:', err);
      alert('Network error while syncing calendar data.');
    } finally {
      setIsSyncing(false);
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

  if (isNaN(minDate.getTime()) || isNaN(maxDate.getTime())) {
    return <div>No work orders have valid calendar dates.</div>;
  }

  const monthsToRender: Date[] = [];
  const currentTrack = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (currentTrack <= maxDate) {
    monthsToRender.push(new Date(currentTrack));
    currentTrack.setMonth(currentTrack.getMonth() + 1);
  }

  return (
    <div
      class="calendar-modal-overlay"
      onClick={(e) => (e.target as HTMLElement).className === 'calendar-modal-overlay' && onClose()}
    >
      <div class="calendar-modal-content" onClick={(e) => e.stopPropagation()}>
        <div class="toolbar">
          <button type="button" class="btn btn-ics" onClick={handleDownloadICS}>
            Download .ICS for Outlook/Google
          </button>
          <button
            type="button"
            class="btn btn-cloud"
            onClick={handleCloudSync}
            disabled={isSyncing}
            style={{ background: '#1a73e8', color: 'white' }}
          >
            {isSyncing ? 'Syncing...' : 'Sync to Google & Outlook'}
          </button>
          <button
            type="button"
            class="btn"
            onClick={onClose}
            style={{ background: '#333', color: 'white' }}
          >
            Close Calendar
          </button>
        </div>

        <div class="calendar-modal-body">
          {monthsToRender.map((monthDate) => {
            const year = monthDate.getFullYear();
            const monthIdx = monthDate.getMonth();
            const mName = monthDate.toLocaleString('default', { month: 'long' });

            const first = new Date(year, monthIdx, 1);
            const offset = first.getDay();
            const daysInMonth = new Date(year, first.getMonth() + 1, 0).getDate();

            const blanks = Array.from({ length: offset });
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

            return (
              <div class="month-box" key={`${year}-${monthIdx}`}>
                <h2>{mName} {year}</h2>
                <div class="grid">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                    <div class="day-h" key={d}>
                      {d}
                    </div>
                  ))}
                  {blanks.map((_, idx) => (
                    <div class="day-c" key={`b-${idx}`} style={{ background: '#f9f9f9' }}></div>
                  ))}
                  {days.map((d) => {
                    const cur = new Date(year, monthIdx, d);
                    return (
                      <div class="day-c" key={`d-${d}`}>
                        <span class="d-num">{d}</span>
                        {data
                          .filter((ev) => cur >= new Date(ev.start) && cur <= new Date(ev.end))
                          .map((ev, evIdx) => (
                            <div class="ev-box" key={evIdx}>
                              {ev.summary}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {syncReport && (
        <SyncStatusModal
          summaryReport={syncReport}
          onClose={() => setSyncReport(null)}
        />
      )}
    </div>
  );
};

async function init() {
  const customRowMapper: Record<string, (cell: HTMLTableCellElement) => Record<string, any>> = {};
  Object.keys(COLUMN_MAPPINGS).forEach((headerText) => {
    const targetProperty = COLUMN_MAPPINGS[headerText];
    customRowMapper[headerText] = (cell) => ({ [targetProperty]: cell.textContent?.trim() || '' });
  });

  const scraper = new Scraper({
    rowMapper: customRowMapper,
    SELECTORS: {
      HEADER: '.rgHeaderRow, .rgMasterTable thead tr:not(.rgFilterRow):not(.rgCommandRow)',
      ROWS: 'tr.rgRow, tr.rgAltRow',
      PAGER: '.rgNumPart .rgCurrentPage',
    },
  });

  console.log('Initializing Work Order background scrape...');
  const rawData = await scraper.scrape();
  const cleanData = (rawData as WorkOrder[]).filter(
    (d) => d.wo && d.start && d.start !== '---'
  );

  if (!cleanData.length) {
    alert('No active work order rows found with scheduled dates.');
    return;
  }

  const existingRoot = document.getElementById('calendar-modal-root');
  if (existingRoot) {
    existingRoot.remove();
  }

  const modalTarget = document.createElement('div');
  modalTarget.id = 'calendar-modal-root';
  document.body.appendChild(modalTarget);

  const handleClose = () => {
    render(null, modalTarget);
    modalTarget.remove();
  };

  render(<CalendarModalApp initialData={cleanData} onClose={handleClose} />, modalTarget);
}

init();