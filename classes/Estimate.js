const { Job } = await import("./Job.js");
const { KanbanPhases } = await import("../modules/enums.js");
const { isDate, getDaysSince, parseCurrency } = await import("../modules/lib.js");

export class Estimate {
  constructor(data) {
    // Identification
    this.uniqueId = data.uniqueId || `cms-${data.jobNumber}`;
    this._jobNumber = data.jobNumber; // Private reference for lookup
    this.type = data.type || 'CMS';
    this.isManual = !!data.isManual;
    this.deleted = !!data.deleted; // Capture the soft-delete state

    this.description = data.description || "Main";

    // Ensure the Job exists
    Job.getOrCreate(data, !data.isManual);

    // Dates
    this.received = data.received;
    this.inspected = data.inspected;
    this.sent = data.sent;
    this.reviewed = data.reviewed
    this.approved = data.approved;
    this.workAuth = data.workAuth;
    this.lastFollowUp = data.lastFollowUp || "";
    this.lastContact = data.lastContact || "";
    this.invoiced = data.invoiced;

    // Financials
    this.origEstimate = parseCurrency(data.origEstimate);
    this.deductible = parseCurrency(data.deductible);
  }

  // --- Job Reference Getters ---
  get job() {
    return Job.instances.get(this._jobNumber);
  }

  get jobNumber() { return this.job?.jobNumber; }
  get customer() { return this.job?.customer; }
  get estimator() { return this.job?.estimator; }
  get division() { return this.job?.division; }
  get url() { return this.job?.url; }
  get xactId() { return this.job?.xactId; }
  get supervisor() { return this.job?.supervisor || ""; }

  get isReviewRequired() { return this.xactId && this.type !== "CO"; }

  get isWarranty() { return this.division === "Warranty"; }
  get isInspected() { return isDate(this.inspected); }
  get isSent() { return isDate(this.sent); }
  get isReviewed() { return isDate(this.reviewed); }
  get isApproved() { return isDate(this.approved); }
  get isProcessed() { return this.origEstimate > 0; }
  get isInvoiced() { return isDate(this.invoiced); }
  get hasSupervisor() { return this.supervisor !== ""; }

  get isActive() {
    if (this.deleted) return false;
    
    this.phase.active;
  }

  get phase() {
    if (this.isWarranty || this.deleted) return KanbanPhases.Completed;
    return KanbanPhases.determinePhase(this);
  }

  get aging() {
    return (this.phase?.aging || (() => 0))(this);
  }

  get tasks() {
    const effectiveContact = this.lastContact || this.inspected || this.received;
    return {
      needsContact: false, //this.phase === KanbanPhases.Approval && getDaysSince(effectiveContact) > 7,
      needsSignedCO: this.type === "CO" && !this.workAuth && !this.isInvoiced,
      needsWorkAuth: this.type === "CMS" && !this.workAuth && !this.isWarranty && !this.isInvoiced,
      needsDeductible: this.type === "CMS" && this.division === "Structure" && this.deductible === 0 && !this.isInvoiced
    };
  }
}
