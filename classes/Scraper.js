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
  }

  scrape() {
    const headerRow = document.querySelector(this.selectors.HEADER);
    if (!headerRow) { console.error("Header not found"); return []; }

    const findIdx = getColMap(headerRow);
    const rows = [...document.querySelectorAll(this.selectors.ROWS)];
    
    // Process and return ONLY this page's array block cleanly
    return rows.map(row => {
      const cells = [...row.querySelectorAll("td")];
      if (!cells.length || !cells[0].textContent.trim()) return null;

      const mappedCells = cells.reduce((acc, cell, index) => {
        const columnName = findIdx(index);
        const cellMapper = this.rowMapper[columnName] || DEFAULT_ROW_MAPPER;
        return {...acc, ...cellMapper(cell, columnName)};
      }, {});
      
      return mappedCells;
    }).filter(Boolean);
  }
}