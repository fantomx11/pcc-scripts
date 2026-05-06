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
  "Completed": {
    column: "Completed",
    active: false,
    kanbanDisplay: false
  },

  determinePhase: function(estimate) {
    return [
      { phase: KanbanPhases.Inspection, isCurrent: true },
      { phase: KanbanPhases.Estimate, isCurrent: estimate.isInspected },
      { phase: KanbanPhases.Review, isCurrent: estimate.isSent },
      { phase: KanbanPhases.Approval, isCurrent: !estimate.isReviewRequired && estimate.isSent || estimate.isReviewed },
      { phase: KanbanPhases.Process, isCurrent: estimate.isApproved },
      { phase: KanbanPhases.AssignPM, isCurrent: estimate.isProcessed && !estimate.hasSupervisor && estimate.division === "Structure" },
      { phase: KanbanPhases.Completed, isCurrent: (estimate.isProcessed && estimate.hasSupervisor) || estimate.isInvoiced }
    ].findLast(e => e.isCurrent).phase;
  }
};
