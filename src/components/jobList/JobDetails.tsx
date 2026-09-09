import type { FunctionalComponent } from 'preact';
import { camelToCapitalCase } from '../../modules/lib';
import type { ProcessedJob } from './types';

interface JobDetailsProps {
  job: ProcessedJob;
  groupByKey?: string;
  flagClasses?: {
    CRITICAL_FLAG_CLASS: string;
    WARNING_FLAG_CLASS: string;
  };
}

export const JobDetails: FunctionalComponent<JobDetailsProps> = ({ job }) => {
  const {
    customer,
    url,
    rowNumber,
    jobId,
    jobFlagLevel,
    flagged,
    rowFlagClass,
    ...other
  } = job;

  return (
    <div>
      <h3>{customer || 'Unknown Customer'}</h3>
      {Object.keys(other).map((item) => (
        <p key={item}>
          <b>{camelToCapitalCase(item)}:</b> {String(other[item] ?? '')}
        </p>
      ))}
    </div>
  );
};