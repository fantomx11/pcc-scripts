import { Scraper } from '../classes/Scraper';

const COMPLIANCE_URL = 'https://dash-ngs.net/NextGear/Enterprise/Module/Admin/ComplianceManager.aspx';

export interface ComplianceTask {
  jobNumber: string;
  actionTitle: string;
  estimatorName: string;
}

function normalizeName(assigneeStr?: string): string {
  if (!assigneeStr) return 'Unassigned';
  const parts = assigneeStr.split(',');
  if (parts.length === 2) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return assigneeStr.trim();
}

export async function fetchComplianceTasks(): Promise<ComplianceTask[]> {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = COMPLIANCE_URL;
  document.body.appendChild(iframe);

  await new Promise(resolve => {
    iframe.onload = resolve;
  });

  try {
    const complianceScraper = new Scraper({
      contextWindow: iframe.contentWindow || window,
      SELECTORS: {
        HEADER: '#ctl00_ContentPlaceHolder1_ComplianceMangerControl_ComplianceManagerGridView_ctl00_Header thead tr',
        ROWS: '#ctl00_ContentPlaceHolder1_ComplianceMangerControl_ComplianceManagerGridView_ctl00 .rgRow, #ctl00_ContentPlaceHolder1_ComplianceMangerControl_ComplianceManagerGridView_ctl00 .rgAltRow',
        PAGER: '.rgNumPart .rgCurrentPage',
      },
    });

    const rawData = await complianceScraper.scrape();

    const complianceTasks: ComplianceTask[] = rawData.map(task => ({
      jobNumber: task.jobNumber || '',
      actionTitle: task.actionTitle || 'General Compliance',
      estimatorName: normalizeName(task.assignee),
    }));

    return complianceTasks;
  } catch (error) {
    console.error('Compliance background fetch failed:', error);
    return [];
  } finally {
    iframe.remove();
  }
}