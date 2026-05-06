const toCamelCase = (str) => {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "") // Remove special characters
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, ""); // Remove spaces
};

function getColMap(headerRow) {
  const cells = [...headerRow.querySelectorAll("th")];
  const textMap = cells.map(c => c.textContent.trim());
  return (name) => Number.isFinite(name) ? textMap[name] : textMap.findIndex(map => map.toLowerCase() === name.toLowerCase());
}

const DEFAULT_SELECTORS = {
  HEADER: ".rgHeaderWrapper thead tr",
  ROWS: "tr.rgRow, tr.rgAltRow",
  PAGER: ".rgNumPart .rgCurrentPage"
};

function DEFAULT_ROW_MAPPER(cell, name) {
  return { [toCamelCase(name)]: cell.textContent.trim() };
}

export class Scraper {
  constructor(config) {
    this.selectors = config.SELECTORS || DEFAULT_SELECTORS;
    this.rowMapper = config.rowMapper || {};
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

      const mappedCells = cells.reduce((acc, cell, index) => {
        const columnName = findIdx(index);
        const cellMapper = this.rowMapper[columnName] || DEFAULT_ROW_MAPPER;
        return {...acc, ...cellMapper(cell, columnName)};
      }, {});
      
      return mappedCells;
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
