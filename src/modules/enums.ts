import { getDaysSince } from './lib';

export interface KanbanPhaseDefinition {
  column: string;
  kanbanDisplay: boolean;
  description?: string;
  aging?: (est: any) => number;
  active: boolean;
  flashIfOccupied: boolean;
  kanbanGroup?: string;
}

export const KanbanPhases = {
  AssignEstimator: {
    column: 'Assign Estimator',
    kanbanDisplay: true,
    description: 'A new job that needs an estimator assigned',
    aging: (est: any) => getDaysSince(est.received),
    active: true,
    flashIfOccupied: true,
    kanbanGroup: 'group-intake',
  },
  Inspection: {
    column: 'Inspection',
    kanbanDisplay: true,
    description: 'Default phase for all new jobs before an inspection date is entered.',
    aging: (est: any) => getDaysSince(est.received),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-pre-con',
  },
  Estimate: {
    column: 'Estimate',
    kanbanDisplay: true,
    description: "Jobs that have been inspected but do not have an 'Estimate Sent' date yet.",
    aging: (est: any) => getDaysSince(est.inspected),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-pre-con',
  },
  Review: {
    column: 'Review',
    kanbanDisplay: true,
    description: "Estimates that have been sent and have an Xactimate ID, but no 'Reviewed' date.",
    aging: (est: any) => getDaysSince(est.sent),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-pre-con',
  },
  Approval: {
    column: 'Approval',
    kanbanDisplay: true,
    description: "Estimates sent/reviewed that are waiting for an 'Approved' date.",
    aging: (est: any) => Math.min(
      est.isReviewRequired ? getDaysSince(est.reviewed) : getDaysSince(est.sent),
      getDaysSince(est.lastFollowUp)
    ),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-pre-con',
  },
  Process: {
    column: 'Process',
    kanbanDisplay: true,
    description: 'Jobs approved but awaiting processing (Total Estimates > $0).',
    aging: (est: any) => getDaysSince(est.approved),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-pre-con',
  },
  AssignPM: {
    column: 'Assign PM',
    kanbanDisplay: true,
    description: 'Structure jobs that are processed but do not have a Supervisor assigned.',
    active: false,
    flashIfOccupied: true,
    kanbanGroup: 'group-pm',
  },
  PreProduction: {
    column: 'Pre-Production',
    kanbanDisplay: true,
    description: 'Job is assigned to a PM and in pre-production setup.',
    aging: (est: any) => getDaysSince(est.approved),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-pm',
  },
  WorkInProgress: {
    column: 'Work in Progress',
    kanbanDisplay: true,
    description: 'Job is actively being reconstructed or mitigated.',
    aging: (est: any) => getDaysSince(est.approved),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-pm',
  },
  CompletedWithoutPaperwork: {
    column: 'Completed Without Paperwork',
    kanbanDisplay: true,
    description: 'Reconstruction completed physically; awaiting closing paperwork.',
    aging: (est: any) => getDaysSince(est.approved),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-pm',
  },
  InvoicePending: {
    column: 'Invoice Pending',
    kanbanDisplay: true,
    description: 'Job package is with accounting awaiting structural invoicing.',
    aging: (est: any) => getDaysSince(est.approved),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-collections',
  },
  AccountsReceivable: {
    column: 'Accounts Receivable',
    kanbanDisplay: true,
    description: 'Invoiced subtotal has been sent to payer; tracking open AR collection aging.',
    aging: (est: any) => getDaysSince(est.invoiced || est.approved),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-collections',
  },
  WaitingForFinalClosure: {
    column: 'Waiting for Final Closure',
    kanbanDisplay: true,
    description: 'Paid but lingering open in the core operating environment.',
    aging: (est: any) => getDaysSince(est.invoiced || est.approved),
    active: true,
    flashIfOccupied: false,
    kanbanGroup: 'group-collections',
  },
  Completed: {
    column: 'Completed',
    active: false,
    flashIfOccupied: false,
    kanbanDisplay: false,
  },

  determinePhase(estimate: any): KanbanPhaseDefinition {
    const status = (estimate.jobStatus || '').toLowerCase();

    const phases = [
      { phase: KanbanPhases.AssignEstimator, isCurrent: true },
      { phase: KanbanPhases.Inspection, isCurrent: Boolean(estimate.hasEstimator) },
      { phase: KanbanPhases.Estimate, isCurrent: Boolean(estimate.isInspected) },
      { phase: KanbanPhases.Review, isCurrent: Boolean(estimate.isSent) },
      { phase: KanbanPhases.Approval, isCurrent: (!estimate.isReviewRequired && Boolean(estimate.isSent)) || Boolean(estimate.isReviewed) },
      { phase: KanbanPhases.Process, isCurrent: Boolean(estimate.isApproved) },
      { phase: KanbanPhases.AssignPM, isCurrent: Boolean(estimate.isProcessed) && !estimate.hasSupervisor && estimate.division === 'Structure' },
      { phase: KanbanPhases.PreProduction, isCurrent: Boolean(estimate.isProcessed) && (Boolean(estimate.hasSupervisor) || estimate.division !== 'Structure') && status.includes('pre-production') },
      { phase: KanbanPhases.WorkInProgress, isCurrent: Boolean(estimate.isProcessed) && status.includes('work in progress') },
      { phase: KanbanPhases.CompletedWithoutPaperwork, isCurrent: Boolean(estimate.isProcessed) && status.includes('completed without paperwork') },
      { phase: KanbanPhases.InvoicePending, isCurrent: Boolean(estimate.isProcessed) && status.includes('invoice pending') },
      { phase: KanbanPhases.AccountsReceivable, isCurrent: Boolean(estimate.isProcessed) && status.includes('accounts receivable') },
      { phase: KanbanPhases.WaitingForFinalClosure, isCurrent: Boolean(estimate.isProcessed) && status.includes('waiting for final closure') },
    ];

    const current = phases.reverse().find(e => e.isCurrent);
    return current ? current.phase : KanbanPhases.AssignEstimator;
  },
};