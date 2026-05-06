getColMap(headerRow) {
  const cells = [...headerRow.querySelectorAll("th")];
  const textMap = cells.map(c => c.textContent.trim().toLowerCase());
  return (name) => textMap.indexOf(name.toLowerCase());
}

export class Scraper {
  constructor(config) {
    this.selectors = config.SELECTORS;
    this.rowMapper = config.rowMapper;
    this.results = [];
  }

  scrape() {
    const headerRow = document.querySelector(this.selectors.HEADER);
    if (!headerRow) return console.error("Header not found");

    const findIdx = getColMap(headerRow);
    const rows = [...document.querySelectorAll(this.selectors.ROWS)];
    
    const pageData = rows.map(row => {
      const cells = row.querySelectorAll("td");
      if (!cells.length || !cells[0].textContent.trim()) return null;
      return this.rowMapper(cells, findIdx);
    }).filter(Boolean);

    this.results.push(...pageData);

    // Handle RadGrid AJAX Pagination
    const nextBtn = document.querySelector(this.selectors.PAGER)?.nextElementSibling;
    
    if (nextBtn && nextBtn.tagName === "A") {
      console.log(`Page scraped. Total items: ${this.results.length}. Loading next...`);
      nextBtn.click();
      return null;
    }

    console.log("Extraction complete.", this.results);
    return this.results;
  }
}
