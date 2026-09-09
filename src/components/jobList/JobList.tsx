import type { FunctionalComponent } from 'preact';
import { TableCell, type CellData } from './TableCell';
import { CopyCell } from './CopyCell';
import type { ProcessedJob } from './types';

interface JobListProps {
  listClass: string;
  tableClass: string;
  jobs: ProcessedJob[];
  selectedJob: string | null;
  setSelectedJob: (jobNumber: string) => void;
  copyTextToClipboard: (text: string) => void;
  includeCopyCell: boolean;
  getUrl: (job: ProcessedJob) => CellData;
}

export const JobList: FunctionalComponent<JobListProps> = ({
  listClass,
  tableClass,
  jobs,
  selectedJob,
  setSelectedJob,
  copyTextToClipboard,
  includeCopyCell,
  getUrl,
}) => {
  return (
    <div class={listClass}>
      <table class={tableClass}>
        <tbody>
          {jobs.map((job) => {
            const isSelected = selectedJob === job.jobNumber;
            const rowClass = `row-style ${isSelected ? 'selected-row' : ''}`.trim();
            const urlData = getUrl(job);

            return (
              <tr
                key={`dash-${job.jobNumber}`}
                class={rowClass}
                onClick={() => setSelectedJob(job.jobNumber)}
              >
                <TableCell
                  cellData={{
                    text: job.customer,
                    background: job.rowFlagClass,
                  }}
                />
                <TableCell
                  cellData={{
                    ...urlData,
                    background: job.rowFlagClass,
                  }}
                />
                {includeCopyCell && (
                  <CopyCell
                    copyText={job.jobNumber}
                    copyTextToClipboard={copyTextToClipboard}
                  />
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};