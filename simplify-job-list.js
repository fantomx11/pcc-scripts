(async (devMode = false) => {
  const baseUrl = devMode ? "https://cdn.statically.io/gh/fantomx11/pcc-scripts@dev" : "https://fantomx11.github.io/pcc-scripts";

  const { Scraper } = await import(`${baseUrl}/classes/Scraper.js`);
  const { html, parseCurrency, copyTextToClipboard } = await import(`${baseUrl}/modules/lib.js`);
  const { h, render } = await import('https://esm.sh/preact');

  const App = window.App = window.App || {};

  const { Dashboard } = await import(`${basUrls}/components/jobList/Dashboard.js`);

  /* --- SCRAPER CONFIG --- */
  const CRITICAL_FLAG_CLASS = "flag-critical",
        WARNING_FLAG_CLASS = "flag-warning";

  const rowMapper = {
    "Job Number": cell => ({ jobNumber: cell.textContent.trim(), url: cell.querySelector("a")?.href }),
    "Xact TransactionID": cell => ({ xactId: cell.textContent.trim() }),
    "Last Journal Note Event Date/Time": cell => ({ journalDate: cell.textContent.trim() }),
    "Total Collected": cell => ({ totalCollected: parseCurrency(cell.textContent.trim()) }),
    "Total Estimates": cell => ({ totalEstimates: parseCurrency(cell.textContent.trim()) }),
    "Total Invoiced": cell => ({ totalInvoiced: parseCurrency(cell.textContent.trim()) }),
  };

  const jobScraper = new Scraper({ rowMapper }, {});

  function processScrapedRow(data) {
    let jobFlagLevel = 0;
    const flagged = {};

    if (data.journalDate) {
      const diff = Math.ceil((new Date() - new Date(data.journalDate)) / 864e5);
      if (diff > 14) { jobFlagLevel = 2; flagged["Last Journal Note Event Date/Time"] = CRITICAL_FLAG_CLASS; }
      else if (diff > 7) { jobFlagLevel = 1; flagged["Last Journal Note Event Date/Time"] = WARNING_FLAG_CLASS; }
    }

    if (Math.abs(data.totalEstimates - data.totalInvoiced) > .01) {
      jobFlagLevel = 2;
      flagged["Total Estimates"] = CRITICAL_FLAG_CLASS;
      flagged["Total Invoiced"] = CRITICAL_FLAG_CLASS;
    }
    if (["Waiting for Final Closure", "Completed without Paperwork"].includes(data.jobStatus) && Math.abs(data.totalCollected - data.totalInvoiced) > .01) {
      jobFlagLevel = 2;
      flagged["Job Status"] = CRITICAL_FLAG_CLASS;
      flagged["Total Collected"] = CRITICAL_FLAG_CLASS;
    }

    return {
      ...data,
      jobFlagLevel,
      flagged
    };
  }

  const rawRows = await jobScraper.scrape();
  let jobs = [];

  if (rawRows) {
    jobs = rawRows.map(row => processScrapedRow(row));

    document.body.innerHTML = "";
    const mountPoint = document.createElement("div");
    document.body.appendChild(mountPoint);

    render(
      html`
        <${Dashboard}
          initialJobs=${jobs} 
          baseUrl=${baseUrl}
          copyTextToClipboard=${copyTextToClipboard}
        />
      `,
      mountPoint
    );
  }
})();