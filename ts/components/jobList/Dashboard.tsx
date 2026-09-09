import { useState, useMemo, useEffect } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import { JobList } from './JobList';
import { JobDetails } from './JobDetails';
import { GroupByList } from './GroupByList';
import { Tabs } from './Tabs';
import type { ProcessedJob, TabGroup } from './types';

export interface DashboardProps {
  initialJobs: ProcessedJob[];
  copyTextToClipboard: (text: string) => void;
}

export const Dashboard: FunctionalComponent<DashboardProps> = ({
  initialJobs,
  copyTextToClipboard,
}) => {
  const [jobs] = useState<ProcessedJob[]>(initialJobs);
  const [groupByKey, setGroupByKey] = useState<string>('estimator');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const { groupedJobs, groups } = useMemo(() => {
    const grouped: Record<string, ProcessedJob[]> = {};
    for (const j of jobs) {
      const k = (j[groupByKey] as string) || 'Unassigned';
      if (!grouped[k]) {
        grouped[k] = [];
      }
      grouped[k].push(j);
    }

    const grps: TabGroup[] = Object.keys(grouped)
      .sort()
      .map((name) => ({ name, count: grouped[name].length }));

    return { groupedJobs: grouped, groups: grps };
  }, [jobs, groupByKey]);

  const [activeTab, setActiveTab] = useState<string | null>(() => groups[0]?.name || null);

  useEffect(() => {
    if (groups.length > 0 && (!activeTab || !groups.some((g) => g.name === activeTab))) {
      setActiveTab(groups[0].name);
    }
  }, [groups, activeTab]);

  const activeGroupJobs = useMemo(() => {
    return activeTab && groupedJobs[activeTab] ? groupedJobs[activeTab] : [];
  }, [activeTab, groupedJobs]);

  useEffect(() => {
    if (
      activeGroupJobs.length > 0 &&
      (!selectedJob || !activeGroupJobs.some((j) => j.jobNumber === selectedJob))
    ) {
      setSelectedJob(activeGroupJobs[0].jobNumber);
    }
  }, [activeGroupJobs, selectedJob]);

  const selectedJobData = useMemo(() => {
    return jobs.find((j) => j.jobNumber === selectedJob) || null;
  }, [jobs, selectedJob]);

  return (
    <div class="main">
      <div class="controls">
        <GroupByList groupBy={groupByKey} setGroupBy={setGroupByKey} />
      </div>

      <Tabs groups={groups} activeTab={activeTab} setActiveTab={setActiveTab} />

      <div class="content">
        <div class="lists-wrapper">
          {activeTab && (
            <div class="pane-style">
              <JobList
                listClass="dash-list"
                tableClass="dash-table"
                jobs={activeGroupJobs}
                selectedJob={selectedJob}
                setSelectedJob={setSelectedJob}
                copyTextToClipboard={copyTextToClipboard}
                includeCopyCell={true}
                getUrl={({ jobNumber, url }) => ({ text: jobNumber, url })}
              />
              <JobList
                listClass="xact-list"
                tableClass="xact-table"
                jobs={activeGroupJobs.filter((job) => Boolean(job.xactId))}
                selectedJob={selectedJob}
                setSelectedJob={setSelectedJob}
                copyTextToClipboard={copyTextToClipboard}
                includeCopyCell={false}
                getUrl={(job) => ({
                  text: 'Xactanalysis',
                  url: `https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${encodeURIComponent(
                    job.xactId || ''
                  )}`,
                })}
              />
            </div>
          )}
        </div>

        <div class="details">
          {selectedJobData ? (
            <JobDetails job={selectedJobData} groupByKey={groupByKey} />
          ) : (
            <p>Select a job to view details.</p>
          )}
        </div>
      </div>
    </div>
  );
};