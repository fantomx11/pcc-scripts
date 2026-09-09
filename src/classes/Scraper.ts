export interface ScraperSelectors {
  HEADER: string;
  ROWS: string;
  PAGER: string;
}

export type CellMapper = (cell: HTMLTableCellElement, columnName: string) => Record<string, any>;

export interface ScraperConfig {
  SELECTORS?: Partial<ScraperSelectors>;
  rowMapper?: Record<string, CellMapper>;
  contextWindow?: Window;
}

const toCamelCase = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, '');
};

function getColMap(headerRow: HTMLTableRowElement) {
  const cells = [...headerRow.querySelectorAll('th')];
  const textMap = cells.map(c => c.textContent?.trim() || '');
  return (nameOrIndex: number | string): string => {
    if (typeof nameOrIndex === 'number') {
      return textMap[nameOrIndex] || '';
    }
    const idx = textMap.findIndex(map => map.toLowerCase() === nameOrIndex.toLowerCase());
    return idx !== -1 ? textMap[idx] : '';
  };
}

const DEFAULT_SELECTORS: ScraperSelectors = {
  HEADER: '.rgHeaderWrapper thead tr',
  ROWS: 'tr.rgRow, tr.rgAltRow',
  PAGER: '.rgNumPart .rgCurrentPage',
};

function DEFAULT_ROW_MAPPER(cell: HTMLTableCellElement, name: string): Record<string, any> {
  return { [toCamelCase(name)]: cell.textContent?.trim() || '' };
}

export class Scraper {
  selectors: ScraperSelectors;
  rowMapper: Record<string, CellMapper>;
  results: Record<string, any>[] = [];
  win: Window;
  doc: Document;

  constructor(config: ScraperConfig = {}) {
    this.selectors = { ...DEFAULT_SELECTORS, ...config.SELECTORS };
    this.rowMapper = config.rowMapper || {};
    this.win = config.contextWindow || window;
    this.doc = this.win.document;
  }

  async scrape(): Promise<Record<string, any>[]> {
    this.results = [];

    let prm: any = null;
    try {
      prm = (this.win as any).Sys?.WebForms?.PageRequestManager?.getInstance();
    } catch {
      console.warn('PageRequestManager not found. Operating in single-page mode.');
    }

    return new Promise((resolve) => {
      const self = this;

      function scrapeCurrentPage() {
        const headerRow = self.doc.querySelector<HTMLTableRowElement>(self.selectors.HEADER);
        if (!headerRow) {
          console.error('Header not found');
          cleanupAndResolve();
          return;
        }

        const findIdx = getColMap(headerRow);
        const rows = [...self.doc.querySelectorAll<HTMLTableRowElement>(self.selectors.ROWS)];

        const pageData = rows.map(row => {
          const cells = [...row.querySelectorAll<HTMLTableCellElement>('td')];
          if (!cells.length) return null;

          return cells.reduce((acc, cell, index) => {
            const columnName = findIdx(index);
            const cellMapper = self.rowMapper[columnName] || DEFAULT_ROW_MAPPER;
            return { ...acc, ...cellMapper(cell, columnName) };
          }, {} as Record<string, any>);
        }).filter((item): item is Record<string, any> => Boolean(item));

        self.results.push(...pageData);
        console.log(`Scraped page. Current total items: ${self.results.length}`);

        const currentPager = self.doc.querySelector(self.selectors.PAGER);
        const nextBtn = currentPager?.nextElementSibling as HTMLElement | null;

        if (nextBtn && nextBtn.tagName === 'A') {
          console.log('Advancing to next grid matrix page...');
          nextBtn.click();
        } else {
          console.log('🏁 Reached the last data view page.');
          cleanupAndResolve();
        }
      }

      function onAjaxComplete() {
        setTimeout(scrapeCurrentPage, 100);
      }

      function cleanupAndResolve() {
        if (prm) {
          prm.remove_endRequest(onAjaxComplete);
        }
        resolve(self.results);
      }

      if (prm) {
        prm.remove_endRequest(onAjaxComplete);
        prm.add_endRequest(onAjaxComplete);
      }

      scrapeCurrentPage();
    });
  }
}