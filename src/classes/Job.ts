export interface JobData {
  jobNumber: string;
  customer?: string;
  estimator?: string;
  division?: string;
  url?: string;
  xactId?: string;
  supervisor?: string;
  // Allows raw estimate objects or scraped payloads to pass through safely
  [key: string]: any;
}

export class Job {
  static instances: Map<string, Job> = new Map();

  jobNumber: string;
  customer: string;
  estimator: string;
  division: string;
  url: string;
  xactId?: string;
  supervisor: string;

  constructor(data: JobData) {
    this.jobNumber = data.jobNumber;
    this.customer = data.customer || "";
    this.estimator = data.estimator || "";
    this.division = data.division || "";
    this.url = data.url || "#";
    this.xactId = data.xactId;
    this.supervisor = data.supervisor || "";

    // Register this instance
    Job.instances.set(this.jobNumber, this);
  }

  /**
   * Finds an existing job or creates a new one
   */
  static getOrCreate(data: JobData, overwrite?: boolean): Job {
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