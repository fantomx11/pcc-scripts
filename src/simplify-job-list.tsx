import { render } from 'preact';

// Bundled and injected directly into the bookmarklet IIFE
import './styles/simplify-job-list.css';

import { Scraper } from './classes/Scraper';
import { parseCurrency, copyTextToClipboard } from './modules/lib';
import { Dashboard } from './components/jobList/Dashboard';
import type { ProcessedJob } from './components/jobList/types';

const CRITICAL_FLAG_CLASS = 'flag-critical';
const WARNING_FLAG_CLASS = 'flag-warning';

const rowMapper = {
  'Job Number': (cell: HTMLTableCellElement) => ({
    jobNumber: cell.textContent?.trim() || '',
    url: cell.querySelector<HTMLAnchorElement>('a')?.href || '',
  }),
  'Xact TransactionID': (cell: HTMLTableCellElement) => ({
    xactId: cell.textContent?.trim() || '',
  }),
  'Last Journal Note Event Date/Time': (cell: HTMLTableCellElement) => ({
    journalDate: cell.textContent?.trim() || '',
  }),
  'Total Collected': (cell: HTMLTableCellElement) => ({
    totalCollected: parseCurrency(cell.textContent?.trim()),
  }),
  'Total Estimates': (cell: HTMLTableCellElement) => ({
    totalEstimates: parseCurrency(cell.textContent?.trim()),
  }),
  'Total Invoiced': (cell: HTMLTableCellElement) => ({
    totalInvoiced: parseCurrency(cell.textContent?.trim()),
  }),
};

const jobScraper = new Scraper({ rowMapper });

function processScrapedRow(data: Record<string, any>): ProcessedJob {
  let jobFlagLevel = 0;
  const flagged: Record<string, string> = {};

  if (data.journalDate) {
    const diff = Math.ceil((Date.now() - new Date(data.journalDate).getTime()) / 864e5);
    if (diff > 14) {
      jobFlagLevel = 2;
      flagged['Last Journal Note Event Date/Time'] = CRITICAL_FLAG_CLASS;
    } else if (diff > 7) {
      jobFlagLevel = 1;
      flagged['Last Journal Note Event Date/Time'] = WARNING_FLAG_CLASS;
    }
  }

  const totalEstimates = Number(data.totalEstimates) || 0;
  const totalInvoiced = Number(data.totalInvoiced) || 0;
  const totalCollected = Number(data.totalCollected) || 0;

  if (Math.abs(totalEstimates - totalInvoiced) > 0.01) {
    jobFlagLevel = 2;
    flagged['Total Estimates'] = CRITICAL_FLAG_CLASS;
    flagged['Total Invoiced'] = CRITICAL_FLAG_CLASS;
  }

  if (
    ['Waiting for Final Closure', 'Completed without Paperwork'].includes(data.jobStatus) &&
    Math.abs(totalCollected - totalInvoiced) > 0.01
  ) {
    jobFlagLevel = 2;
    flagged['Job Status'] = CRITICAL_FLAG_CLASS;
    flagged['Total Collected'] = CRITICAL_FLAG_CLASS;
  }

  const rowFlagClass =
    jobFlagLevel === 2 ? CRITICAL_FLAG_CLASS :
    jobFlagLevel === 1 ? WARNING_FLAG_CLASS : undefined;

  return {
    ...data,
    jobNumber: data.jobNumber || '',
    customer: data.customer || '',
    jobFlagLevel,
    flagged,
    rowFlagClass,
  };
}

async function init() {
  const rawRows = await jobScraper.scrape();

  if (rawRows && rawRows.length > 0) {
    const jobs: ProcessedJob[] = rawRows.map((row) => processScrapedRow(row));

    // Clear host DOM completely to eliminate NextGear/Dash layout and styles
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.id = 'simplify-job-list-root';
    document.body.appendChild(root);

    render(
      <Dashboard
        initialJobs={jobs}
        copyTextToClipboard={copyTextToClipboard}
      />,
      root
    );
  } else {
    console.warn('No grid rows found to simplify.');
  }
}

init();