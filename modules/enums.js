const {getDaysSince} = await import("./lib.js");

export const KanbanPhases = {
  "Inspection": {
    column: "Inspection",
    kanbanDisplay: true,
    description: "Default phase for all new jobs before an inspection date is entered.",
    aging: est => getDaysSince(est.received),
    active: true,
    kanbanGroup: "group-pre-con"
  },
  "Estimate": {
    column: "Estimate",
    kanbanDisplay: true,
    description: "Jobs that have been inspected but do not have an 'Estimate Sent' date yet.",
    aging: est => getDaysSince(est.inspected),
    active: true,
    kanbanGroup: "group-pre-con"
  },
  "Review": {
    column: "Review",
    kanbanDisplay: true,
    description: "Estimates that have been sent and have an Xactimate ID, but no 'Reviewed' date.",
    aging: est => getDaysSince(est.sent),
    active: true,
    kanbanGroup: "group-pre-con"
  },
  "Approval": {
    column: "Approval",
    kanbanDisplay: true,
    description: "Estimates sent/reviewed that are waiting for an 'Approved' date.",
    aging: est => Math.min(est.isReviewRequired ? getDaysSince(est.reviewed) : getDaysSince(est.sent), getDaysSince(est.lastFollowUp)),
    active: true,
    kanbanGroup: "group-pre-con"
  },
  "Process": {
    column: "Process",
    kanbanDisplay: true,
    description: "Jobs approved but awaiting processing (Total Estimates > $0).",
    aging: est => getDaysSince(est.approved),
    active: true,
    kanbanGroup: "group-pre-con"
  },
  "AssignPM": {
    column: "Assign PM",
    kanbanDisplay: true,
    description: "Structure jobs that are processed but do not have a Supervisor assigned. Adding an invoice date will bypass PM assignment.",
    active: false,
    kanbanGroup: "group-pm"
  },

  "PreProduction": {
    column: "Pre-Production",
    kanbanDisplay: true,
    description: "Job is assigned to a PM and in pre-production setup.",
    aging: est => getDaysSince(est.approved),
    active: true,
    kanbanGroup: "group-pm"    
  },
  "WorkInProgress": {
    column: "Work in Progress",
    kanbanDisplay: true,
    description: "Job is actively being reconstructed or mitigated.",
    aging: est => getDaysSince(est.approved),
    active: true,
    kanbanGroup: "group-pm"
  },
  "CompletedWithoutPaperwork": {
    column: "Completed Without Paperwork",
    kanbanDisplay: true,
    description: "Reconstruction completed physically; awaiting closing paperwork.",
    aging: est => getDaysSince(est.approved),
    active: true,
    kanbanGroup: "group-pm"
  },  

  "InvoicePending": {
    column: "Invoice Pending",
    kanbanDisplay: true,
    description: "Job package is with accounting awaiting structural invoicing.",
    aging: est => getDaysSince(est.approved),
    active: true,
    kanbanGroup: "group-collections"
  },
  "AccountsReceivable": {
    column: "Accounts Receivable",
    kanbanDisplay: true,
    description: "Invoiced subtotal has been sent to payer; tracking open AR collection aging.",
    aging: est => getDaysSince(est.invoiced || est.approved),
    active: true,
    kanbanGroup: "group-collections"
  },
  "WaitingForFinalClosure": {
    column: "Waiting for Final Closure",
    kanbanDisplay: true,
    description: "Paid but lingering open in the core operating environment.",
    aging: est => getDaysSince(est.invoiced || est.approved),
    active: true,
    kanbanGroup: "group-collections"
  },

  "Completed": {
    column: "Completed",
    active: false,
    kanbanDisplay: false
  },

  determinePhase: function(estimate) {
    const status = (estimate.jobStatus || "").toLowerCase();

    return [
      { phase: KanbanPhases.Inspection, isCurrent: true },
      { phase: KanbanPhases.Estimate, isCurrent: estimate.isInspected },
      { phase: KanbanPhases.Review, isCurrent: estimate.isSent },
      { phase: KanbanPhases.Approval, isCurrent: !estimate.isReviewRequired && estimate.isSent || estimate.isReviewed },
      { phase: KanbanPhases.Process, isCurrent: estimate.isApproved },
      { phase: KanbanPhases.AssignPM, isCurrent: estimate.isProcessed && !estimate.hasSupervisor && estimate.division === "Structure" },
      { phase: KanbanPhases.PreProduction, isCurrent: estimate.isProcessed && (estimate.hasSupervisor || estimate.division !== "Structure") && status.includes("pre-production") },
      { phase: KanbanPhases.WorkInProgress, isCurrent: estimate.isProcessed && status.includes("work in progress") },
      { phase: KanbanPhases.CompletedWithoutPaperwork, isCurrent: estimate.isProcessed && status.includes("completed without paperwork") },
      { phase: KanbanPhases.InvoicePending, isCurrent: estimate.isProcessed && status.includes("invoice pending") },
      { phase: KanbanPhases.AccountsReceivable, isCurrent: estimate.isProcessed && status.includes("accounts receivable") },
      { phase: KanbanPhases.WaitingForFinalClosure, isCurrent: estimate.isProcessed && status.includes("waiting for final closure") },    
    ].findLast(e => e.isCurrent).phase;
  }
};
