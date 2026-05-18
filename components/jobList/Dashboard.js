import { useState, useEffect } from 'https://esm.sh/preact/hooks';
import { html } from '../../modules/lib.js';

import { JobList } from './JobList.js';
import { JobDetails } from './JobDetails.js';
import { GroupByList } from './GroupByList.js';
import { Tabs } from './Tabs.js';
import { TableCell } from './TableCell.js';
import { CopyCell } from './CopyCell.js';

export function Dashboard({ initialJobs, baseUrl, copyTextToClipboard }) {
  const [jobs] = useState(initialJobs);
  const [groupByKey, setGroupByKey] = useState("estimator");
  const [selectedJob, setSelectedJob] = useState(null);
  const [activeTab, setActiveTab] = useState(null);

  const CRITICAL_FLAG_CLASS = "flag-critical";
  const WARNING_FLAG_CLASS = "flag-warning";

  let groupedJobs = {};
  let groups = [];

  function updateGroupData() {
    groupedJobs = {};
    jobs.forEach(j => {
      const k = j[groupByKey] || "Unassigned";
      groupedJobs[k] = groupedJobs[k] || [];
      groupedJobs[k].push(j);
    });

    groups = Object.keys(groupedJobs).sort().map(name => ({ name, count: groupedJobs[name].length }))

    if (groups.length > 0 && !groups.some(g => g.name === activeTab)) {
      setActiveTab(groups[0].name);
    }
  }

  useEffect(() => updateGroupData(), [groupByKey]);
  updateGroupData();

  let activeGroupJobs = groupedJobs[activeTab] || [];

  useEffect(() => {
    if (activeTab && groupedJobs[activeTab]) {
      activeGroupJobs = groupedJobs[activeTab] || [];
      setSelectedJob(groupedJobs[activeTab][0]?.jobNumber || null);
    }
  }, [activeTab]);


  return html`
    <div class="main">
      <link rel="stylesheet" href="${baseUrl}/styles/simplify-job-list.css" />
      
      <div class="controls">
        <${GroupByList} setGroupBy=${setGroupByKey} groupBy=${groupByKey} />
      </div>

      <${Tabs} groups=${groups} activeTab=${activeTab} setActiveTab=${setActiveTab} />
      
      <div class="content">
        <div class="lists-wrapper">
          ${activeTab && html`
            <div class="pane-style">
              <${JobList} listClass="dash-list" tableClass="dash-table" jobs=${activeGroupJobs} selectedJob=${selectedJob} setSelectedJob=${setSelectedJob} copyTextToClipboard=${copyTextToClipboard} includeCopyCell=${true} getUrl=${({jobNumber, url}) => ({text: jobNumber, url})}/>
              <${JobList} listClass="xact-list" tableClass="xact-table" jobs=${activeGroupJobs.filter(job => job.xactId !== "")} selectedJob=${selectedJob} setSelectedJob=${setSelectedJob} copyTextToClipboard=${copyTextToClipboard} includeCopyCell=${false} getUrl=${job => ({text: "Xactanalysis", url: `https://www.xactanalysis.com/apps/cxa/detail.jsp?mfn=${job.xactId}`})} />
            </div>
          `}
        </div>
        
        <div class="details">
          ${selectedJob
      ? html`<${JobDetails} job=${jobs.find(j => j.jobNumber === selectedJob)} groupByKey=${groupByKey} flagClasses=${{ CRITICAL_FLAG_CLASS, WARNING_FLAG_CLASS }} />`
      : html`<p>Select a job to view details.</p>`
    }
        </div>
      </div>
    </div>
  `;
}