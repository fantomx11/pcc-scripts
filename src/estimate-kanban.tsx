import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// 1. Direct CSS import (Inlined into the JS bundle by Vite plugin)
import './styles/estimate-kanban.css';

// 2. Data Models & Utilities
import { Estimate, type EstimateData } from './classes/Estimate';
import { Scraper } from './classes/Scraper';
import { Store, type SyncStatus } from './classes/Store';
import { fetchComplianceTasks, type ComplianceTask } from './modules/compliance';

// 3. Components
import { EstimatorTabs } from './components/EstimatorTabs';
import { FilterGroup } from './components/FilterGroup';
import { KanbanBoard } from './components/KanbanBoard';
import { Modal } from './components/Modal';
import { Sidebar } from './components/Sidebar';
import { SyncIndicator } from './components/SyncIndicator';

// Maintain the window.App registry for external console/modal access
const App = ((window as any).App = (window as any).App || {});

const CONFIG = {
  KEYS: {
    MANUAL: 'manual_estimates_v8',
    OVERRIDE: 'cms_overrides_v1',
  },
};

const scraper = (App.scraper = App.scraper || new Scraper({
  rowMapper: {
    'Job Number': cell => ({ jobNumber: cell.textContent?.trim() || '', url: cell.querySelector('a')?.href }),
    Estimator: cell => ({ estimator: cell.textContent?.trim() || '' }),
    'Date Received': cell => ({ received: cell.textContent?.trim() || '' }),
    'Date Inspected': cell => ({ inspected: cell.textContent?.trim() || '' }),
    'Date Estimate Sent': cell => ({ sent: cell.textContent?.trim() || '' }),
    'Date Estimate Approved': cell => ({ approved: cell.textContent?.trim() || '' }),
    'Date of Work Authorization': cell => ({ workAuth: cell.textContent?.trim() || '' }),
    'Deductible Amount': cell => ({ deductible: cell.textContent?.trim() || '' }),
    'Original Estimate': cell => ({ origEstimate: cell.textContent?.trim() || '' }),
    'Xact TransactionID': cell => ({ xactId: cell.textContent?.trim() || '' }),
    'Date Invoiced': cell => ({ invoiced: cell.textContent?.trim() || '' }),
    'Job Completion(%)': cell => ({ jobCompletion: cell.textContent?.trim() || '' }),
  },
}));

const ORIGINAL_PAGE_URL = window.location.href;

async function fetchBackgroundScrapedData(): Promise<Record<string, any>[] | null> {
  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = ORIGINAL_PAGE_URL;
  document.body.appendChild(iframe);

  await new Promise(resolve => {
    iframe.onload = resolve;
  });

  try {
    const backgroundScraper = new Scraper({
      contextWindow: iframe.contentWindow || window,
      rowMapper: scraper.rowMapper,
    });

    return await backgroundScraper.scrape();
  } catch (err) {
    console.error('Background scrape failed:', err);
    return null;
  } finally {
    iframe.remove();
  }
}

interface AppProps {
  initialEstimates: Estimate[];
}

export const KanbanApp = ({ initialEstimates }: AppProps) => {
  const [estimates, setEstimates] = useState<Estimate[]>(initialEstimates);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');
  const [complianceTasks, setComplianceTasks] = useState<ComplianceTask[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const allDivisions = [...new Set(estimates.map(e => e.division || ''))].filter(Boolean).sort();
  const [selectedDivs, setSelectedDivs] = useState<string[]>(allDivisions);

  useEffect(() => {
    App.openModal = (id: string | null = null) => {
      console.log('Opening modal for:', id);
      setEditingId(id || `new-${Date.now()}`);
    };
  }, []);

  useEffect(() => {
    Store.statusListener = (status) => setSyncStatus(status);
    Store.onCacheRebuilt = (updatedEstimates) => setEstimates(updatedEstimates);

    Store.initialFetch(App.scraper.results, Estimate);

    fetchComplianceTasks().then((tasks) => {
      setComplianceTasks(tasks);
    });

    // 10-minute interval background polling (10 * 60 * 1000 ms)
    const POLL_INTERVAL = 10 * 60 * 1000;
    const intervalId = setInterval(async () => {
      Store.updateStatusUI('syncing with Dash');
      const freshData = await fetchBackgroundScrapedData();

      if (freshData && freshData.length > 0) {
        App.scraper.results = freshData;
        Store.rebuildLocal(freshData, Estimate);
        Store.updateStatusUI('saved');
      } else {
        Store.updateStatusUI('saved');
      }
    }, POLL_INTERVAL);

    return () => {
      clearInterval(intervalId);
      Store.statusListener = null;
      Store.onCacheRebuilt = null;
    };
  }, []);

  const handleSave = (formData: Record<string, any>) => {
    const isCms = String(formData.uniqueId || '').startsWith('cms-');

    if (isCms) {
      const ov = Store.get(CONFIG.KEYS.OVERRIDE);
      ov[formData.jobNumber] = {
        lastFollowUp: formData.lastFollowUp,
        lastContact: formData.lastContact,
        reviewed: formData.reviewed,
      };
      Store.save(CONFIG.KEYS.OVERRIDE, ov);
    } else {
      const mans: EstimateData[] = Store.get(CONFIG.KEYS.MANUAL);
      const index = mans.findIndex(m => m.uniqueId === formData.uniqueId);

      if (index > -1) {
        mans[index] = formData as EstimateData;
      } else {
        formData.uniqueId = 'cust-' + Date.now();
        mans.push(formData as EstimateData);
      }

      Store.save(CONFIG.KEYS.MANUAL, mans);
    }

    Store.rebuildLocal(App.scraper.results, Estimate);
    setEstimates(Array.from(Store.all.values()));
    setEditingId(null);
    Store.push();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this local entry?')) {
      const targetId = String(id);
      let mans: EstimateData[] = Store.get(CONFIG.KEYS.MANUAL);
      mans = mans.map(m => (String(m.uniqueId) === targetId ? { ...m, deleted: true } : m));
      Store.save(CONFIG.KEYS.MANUAL, mans);

      Store.rebuildLocal(App.scraper.results, Estimate);
      setEstimates(Array.from(Store.all.values()));
      setEditingId(null);
      Store.push();
    }
  };

  const currentEstimate = estimates.find(e => e.uniqueId === editingId) || ({
    uniqueId: editingId,
    isManual: true,
    type: 'SUPP',
    estimator: activeTab !== 'All' ? activeTab : 'Unassigned',
  } as any);

  return (
    <div>
      <div class="dash-container">
        <div class="tabs-bar">
          <EstimatorTabs
            estimates={estimates}
            activeTab={activeTab}
            selectedDivs={selectedDivs}
            onTabChange={setActiveTab}
          />
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {complianceTasks === null ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', marginRight: '15px' }}>
                <div class="spinner"></div>
                <span
                  style={{
                    fontSize: '10px',
                    color: '#e67e22',
                    fontWeight: 'bold',
                    marginLeft: '5px',
                    textTransform: 'uppercase',
                  }}
                >
                  Loading Compliance...
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '10px', color: '#27ae60', marginRight: '15px', fontWeight: 'bold' }}>
                {complianceTasks.length} COMPLIANCE TASKS LOADED
              </span>
            )}
            <FilterGroup divisions={allDivisions} onFilterChange={setSelectedDivs} />
            <SyncIndicator status={syncStatus} />
            <button class="add-btn" onClick={() => App.openModal()}>
              + ADD SUPP/CO
            </button>
          </div>
        </div>
        <div class="main-content">
          <KanbanBoard
            estimates={estimates}
            activeEstimator={activeTab}
            selectedDivs={selectedDivs}
          />
          <Sidebar
            jobs={estimates}
            activeEstimator={activeTab}
            selectedDivs={selectedDivs}
            complianceTasks={complianceTasks}
          />
        </div>
      </div>

      {editingId && (
        <Modal
          estimate={currentEstimate}
          estimates={estimates}
          onClose={() => setEditingId(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

// Application Bootstrap
async function init() {
  const scrapedData = await scraper.scrape();

  if (scrapedData) {
    window.addEventListener('beforeunload', (e) => {
      if (Store.isSyncing) {
        e.preventDefault();
        e.returnValue = 'Data is still syncing...';
      }
    });

    App.store = Store;
    Store.rebuildLocal(scrapedData, Estimate);

    const root = document.body;
    root.innerHTML = ''; // Fresh mount target

    render(<KanbanApp initialEstimates={Array.from(Store.all.values())} />, root);
  }
}

init();