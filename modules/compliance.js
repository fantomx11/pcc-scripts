const COMPLIANCE_URL = "https://dash-ngs.net/NextGear/Enterprise/Module/Admin/ComplianceManager.aspx";

/**
 * Normalizes an assignee string from "Last, First" to "First Last" to match Kanban estimators
 */
function normalizeName(assigneeStr) {
  if (!assigneeStr) return "Unassigned";
  const parts = assigneeStr.split(",");
  if (parts.length === 2) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return assigneeStr.trim();
}

export async function fetchComplianceTasks() {
  // 1. Create a hidden background sandbox iframe
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = COMPLIANCE_URL;
  document.body.appendChild(iframe);

  await new Promise(resolve => iframe.onload = resolve);

  try {
    // 2. Import your generic Scraper class dynamically
    const { Scraper } = await import("../classes/Scraper.js");

    const complianceScraper = new Scraper({
      contextWindow: iframe.contentWindow,
      SELECTORS: {
        HEADER: "#ctl00_ContentPlaceHolder1_ComplianceMangerControl_ComplianceManagerGridView_ctl00_Header thead tr",
        ROWS: "#ctl00_ContentPlaceHolder1_ComplianceMangerControl_ComplianceManagerGridView_ctl00 .rgRow, #ctl00_ContentPlaceHolder1_ComplianceMangerControl_ComplianceManagerGridView_ctl00 .rgAltRow",
        PAGER: ".rgNumPart .rgCurrentPage"
      }
    });

    // 3. Scrape and map the data down to relevant fields
    const rawData = await complianceScraper.scrape();
    
    // Normalize properties and names on extraction
    const complianceTasks = rawData.map(task => ({
      jobNumber: task.jobNumber || "",
      actionTitle: task.actionTitle || "General Compliance",
      estimatorName: normalizeName(task.assignee)
    }));

    return complianceTasks;

  } catch (error) {
    console.error("Compliance background fetch failed:", error);
    return [];
  } finally {
    iframe.remove();
  }
}
