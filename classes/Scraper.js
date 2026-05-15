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

export class Scraper {
  constructor(config) {
    this.selectors = config.SELECTORS || DEFAULT_SELECTORS;
    this.rowMapper = config.rowMapper || {};
    this.results = [];
  }

  /**
   * Scrapes all pages automatically via ASP.NET AJAX events
   * @returns {Promise<Array>} Resolves with the complete accumulated dataset
   */
  async scrape() {
    this.results = []; // Reset accumulator for fresh runs
    
    // Access ASP.NET PageRequestManager if it exists
    let prm = null;
    try {
      prm = window.Sys.WebForms.PageRequestManager.getInstance();
    } catch (e) {
      console.warn("PageRequestManager not found. Operating in single-page mode.");
    }

    // Wrap the pagination sequence inside a Promise
    return new Promise((resolve) => {
      const self = this;

      function scrapeCurrentPage() {
        const headerRow = document.querySelector(self.selectors.HEADER);
        if (!headerRow) {
          console.error("Header not found");
          cleanupAndResolve();
          return;
        }

        const findIdx = getColMap(headerRow);
        const rows = [...document.querySelectorAll(self.selectors.ROWS)];
        
        const pageData = rows.map(row => {
          const cells = [...row.querySelectorAll("td")];
          if (!cells.length || !cells[0].textContent.trim()) return null;

          return cells.reduce((acc, cell, index) => {
            const columnName = findIdx(index);
            const cellMapper = self.rowMapper[columnName] || DEFAULT_ROW_MAPPER;
            return {...acc, ...cellMapper(cell, columnName)};
          }, {});
        }).filter(Boolean);

        self.results.push(...pageData);
        console.log(`Scraped page. Current total items: ${self.results.length}`);

        // Handle RadGrid AJAX Pagination
        const currentPager = document.querySelector(self.selectors.PAGER);
        const nextBtn = currentPager?.nextElementSibling;

        if (nextBtn && nextBtn.tagName === "A") {
          console.log("Advancing to next grid matrix page...");
          nextBtn.click();
          // The promise remains pending; prm event listener will catch the postback return
        } else {
          console.log("🏁 Reached the last data view page.");
          cleanupAndResolve();
        }
      }

      // Callback executed instantly when the async WebForms postback settles
      function onAjaxComplete(sender, args) {
        setTimeout(scrapeCurrentPage, 100); // Allow DOM layout to stabilize
      }

      function cleanupAndResolve() {
        if (prm) {
          prm.remove_endRequest(onAjaxComplete);
        }
        resolve(self.results);
      }

      // Bind to the framework AJAX manager lifecycle if present
      if (prm) {
        prm.remove_endRequest(onAjaxComplete); // Clear hung instances
        prm.add_endRequest(onAjaxComplete);
      }

      // Kickoff first page parsing iteration
      scrapeCurrentPage();
    });
  }
}