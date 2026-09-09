export interface ProcessedJob {
  jobNumber: string;
  customer: string;
  estimator?: string;
  supervisor?: string;
  accountingPerson?: string;
  url?: string;
  xactId?: string;
  journalDate?: string;
  totalCollected?: number;
  totalEstimates?: number;
  totalInvoiced?: number;
  jobStatus?: string;
  jobFlagLevel: number;
  flagged: Record<string, string>;
  rowFlagClass?: string;
  [key: string]: unknown;
}

export interface TabGroup {
  name: string;
  count: number;
}