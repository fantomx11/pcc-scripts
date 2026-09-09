import { Job, type JobData } from './Job';
import { KanbanPhases, type KanbanPhaseDefinition } from '../modules/enums';
import { isDate, getDaysSince, parseCurrency, parsePercentage } from '../modules/lib';

export interface EstimateData extends JobData {
  uniqueId?: string;
  jobNumber: string;
  type?: 'CMS' | 'CO' | string;
  isManual?: boolean;
  deleted?: boolean;
  description?: string;
  received?: string;
  inspected?: string;
  sent?: string;
  reviewed?: string;
  approved?: string;
  workAuth?: string;
  lastFollowUp?: string;
  lastContact?: string;
  invoiced?: string;
  origEstimate?: string | number;
  deductible?: string | number;
  jobStatus?: string;
  jobCompleted?: string | number;
}

export interface EstimateTasks {
  needsContact?: boolean;
  needsSignedCO?: boolean;
  needsWorkAuth?: boolean;
  needsDeductible?: boolean;
}

export class Estimate {
  uniqueId: string;
  private _jobNumber: string;
  type: string;
  isManual: boolean;
  deleted: boolean;
  description: string;

  received?: string;
  inspected?: string;
  sent?: string;
  reviewed?: string;
  approved?: string;
  workAuth?: string;
  lastFollowUp: string;
  lastContact: string;
  invoiced?: string;

  origEstimate: number;
  deductible: number;
  jobStatus: string;
  jobCompleted: number;

  constructor(data: EstimateData) {
    this.uniqueId = data.uniqueId ? String(data.uniqueId) : `cms-${data.jobNumber}`;
    this._jobNumber = data.jobNumber;
    this.type = data.type || 'CMS';
    this.isManual = Boolean(data.isManual);
    this.deleted = Boolean(data.deleted);
    this.description = data.description || 'Main';

    Job.getOrCreate(data, !data.isManual);

    this.received = data.received;
    this.inspected = data.inspected;
    this.sent = data.sent;
    this.reviewed = data.reviewed;
    this.approved = data.approved;
    this.workAuth = data.workAuth;
    this.lastFollowUp = data.lastFollowUp || '';
    this.lastContact = data.lastContact || '';
    this.invoiced = data.invoiced;

    this.origEstimate = parseCurrency(data.origEstimate);
    this.deductible = parseCurrency(data.deductible);
    this.jobStatus = data.jobStatus || '';
    this.jobCompleted = data.jobCompleted ? parsePercentage(data.jobCompleted) || 0 : 0;
  }

  get job(): Job | undefined {
    return Job.instances.get(this._jobNumber);
  }

  get jobNumber(): string | undefined { return this.job?.jobNumber; }
  get customer(): string | undefined { return this.job?.customer; }
  get estimator(): string | undefined { return this.job?.estimator; }
  get division(): string | undefined { return this.job?.division; }
  get url(): string | undefined { return this.job?.url; }
  get xactId(): string | undefined { return this.job?.xactId; }
  get supervisor(): string { return this.job?.supervisor || ''; }

  get isReviewRequired(): boolean { return Boolean(this.xactId && this.type !== 'CO'); }
  get isWarranty(): boolean { return this.division === 'Warranty'; }
  get isInspected(): boolean { return isDate(this.inspected); }
  get isSent(): boolean { return isDate(this.sent); }
  get isReviewed(): boolean { return isDate(this.reviewed); }
  get isApproved(): boolean { return isDate(this.approved); }
  get isProcessed(): boolean { return this.origEstimate > 0; }
  get isInvoiced(): boolean { return isDate(this.invoiced); }
  get hasSupervisor(): boolean { return this.supervisor !== ''; }
  get hasEstimator(): boolean { return Boolean(this.estimator && this.estimator !== ''); }

  get isActive(): boolean {
    if (this.deleted) return false;
    return this.phase.active;
  }

  get phase(): KanbanPhaseDefinition {
    if (this.isWarranty || this.deleted) return KanbanPhases.Completed;
    return KanbanPhases.determinePhase(this);
  }

  get aging(): number {
    return (this.phase?.aging || (() => 0))(this);
  }

  get tasks(): EstimateTasks {
    if (this.deleted) return {};

    const effectiveContact = this.lastContact || this.inspected || this.received;
    return {
      needsContact: this.phase === KanbanPhases.Approval && getDaysSince(effectiveContact) > 7,
      needsSignedCO: this.type === 'CO' && !this.workAuth && !this.isInvoiced,
      needsWorkAuth: this.type === 'CMS' && !this.workAuth && !this.isWarranty && !this.isInvoiced,
      needsDeductible: this.type === 'CMS' && this.division === 'Structure' && this.deductible === 0 && !this.isInvoiced,
    };
  }
}