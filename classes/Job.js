export class Job {
  static instances = new Map();

  constructor(data) {
    this.jobNumber = data.jobNumber;
    this.customer = data.customer;
    this.estimator = data.estimator || "Unassigned";
    this.division = data.division;
    this.url = data.url || "#";
    this.xactId = data.xactId;
    this.supervisor = data.supervisor || "";

    // Register this instance
    Job.instances.set(this.jobNumber, this);
  }

  /**
   * Finds an existing job or creates a new one
   */
  static getOrCreate(data, overwrite) {
    let job = Job.instances.get(data.jobNumber);

    if (!job || overwrite) {
      job = new Job(data);
    } else {
      // Fill in missing values if the new data provides them
      if ((!job.url || job.url === "#") && data.url) {
        job.url = data.url;
      }
      if (!job.xactId && data.xactId) {
        job.xactId = data.xactId;
      }
    }
    return job;
  }
}