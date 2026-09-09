import { useState, useMemo } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import type { EstimateModel } from '../models/EstimateModel';
import { XactDocBuilder } from '../exporters/XactDocBuilder';
import { EsxPackager } from '../exporters/EsxPackager';

interface Step3Props {
  model: EstimateModel;
  onModelChange: () => void;
}

const PRESET_CATEGORIES = [
  { code: 'PNT', label: 'PNT - Painting' },
  { code: 'DRY', label: 'DRY - Drywall' },
  { code: 'FCC', label: 'FCC - Floor Covering - Carpet' },
  { code: 'FCW', label: 'FCW - Floor Covering - Wood / Lam' },
  { code: 'FCV', label: 'FCV - Floor Covering - Vinyl' },
  { code: 'FCT', label: 'FCT - Floor Covering - Ceramic Tile' },
  { code: 'CAB', label: 'CAB - Cabinetry' },
  { code: 'PLM', label: 'PLM - Plumbing' },
  { code: 'ELE', label: 'ELE - Electrical' },
  { code: 'HVC', label: 'HVC - Heat, Vent, & Air' },
  { code: 'RFG', label: 'RFG - Roofing' },
  { code: 'SDG', label: 'SDG - Siding' },
  { code: 'INS', label: 'INS - Insulation' },
  { code: 'WTR', label: 'WTR - Water Extraction' },
  { code: 'CLN', label: 'CLN - Cleaning' },
  { code: 'DMO', label: 'DMO - General Demolition' },
];

export const Step3CategoryQueue: FunctionalComponent<Step3Props> = ({
  model,
  onModelChange,
}) => {
  const [filterText, setFilterText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [selectedDescriptions, setSelectedDescriptions] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; color: string } | null>(null);

  const allDescriptions = useMemo(() => model.getUniqueDescriptions(), [model]);

  const { unmapped, mapped } = useMemo(() => {
    const un: string[] = [];
    const ma: string[] = [];
    allDescriptions.forEach((d) => {
      if (model.isDescriptionMapped(d)) ma.push(d);
      else un.push(d);
    });
    return { unmapped: un, mapped: ma };
  }, [allDescriptions, model.categoryMappings]);

  const visibleUnmapped = useMemo(() => {
    return unmapped.filter((d) => d.toLowerCase().includes(filterText.toLowerCase()));
  }, [unmapped, filterText]);

  const visibleMapped = useMemo(() => {
    return mapped.filter((d) => d.toLowerCase().includes(filterText.toLowerCase()));
  }, [mapped, filterText]);

  const progress = allDescriptions.length > 0 ? (mapped.length / allDescriptions.length) * 100 : 0;
  const isFullyMapped = model.isFullyMapped();
  const hasSettings = model.hasValidSettings();
  const canExport = isFullyMapped && hasSettings;

  const handleApplyCategory = () => {
    const code = (customCategory.trim() || selectedCategory).toUpperCase();
    if (!code || code.length !== 3) {
      alert('Please select or type a valid 3-letter category code (e.g. PNT, DRY).');
      return;
    }

    selectedDescriptions.forEach((desc) => {
      model.mapCategory(desc, code);
    });

    setSelectedDescriptions(new Set());
    setSelectedCategory('');
    setCustomCategory('');
    onModelChange();
  };

  const handleToggleSelectAll = (checked: boolean) => {
    const next = new Set(selectedDescriptions);
    visibleUnmapped.forEach((d) => {
      if (checked) next.add(d);
      else next.delete(d);
    });
    setSelectedDescriptions(next);
  };

  const handleItemClick = (desc: string, index: number, e: MouseEvent) => {
    const next = new Set(selectedDescriptions);

    if (e.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      for (let i = start; i <= end; i++) {
        next.add(visibleUnmapped[i]);
      }
    } else {
      if (next.has(desc)) next.delete(desc);
      else next.add(desc);
      setLastClickedIndex(index);
    }
    setSelectedDescriptions(next);
  };

  const handleExport = async () => {
    if (!model.hasValidSettings()) {
      alert('Please ensure Project ID, Customer Name, and Material Tax Rate are filled out.');
      return;
    }

    setStatusMsg({ text: 'Rebuilding XACTDOC.XML and applying exact material tax splits...', color: 'black' });

    try {
      const xmlString = XactDocBuilder.buildXml(model);
      setStatusMsg({ text: 'Compressing & encrypting inner archive via AES-256...', color: 'black' });

      const esxBlob = await EsxPackager.createEsx(xmlString);
      const filename = model.getFormattedFilename();

      const downloadUrl = URL.createObjectURL(esxBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setStatusMsg({ text: `Success! Downloaded: ${filename}`, color: 'var(--success)' });
    } catch (err: any) {
      console.error(err);
      setStatusMsg({ text: `Export error: ${err.message}`, color: 'var(--error)' });
    }
  };

  return (
    <div class="card" id="viewStep3">
      <h2>
        3. Trade Category Mapping Queue
        <span
          class={`detection-badge ${model.isEnrichedSource ? 'badge-enriched' : 'badge-minimal'}`}
        >
          {model.isEnrichedSource ? 'Native Xactimate Data Auto-Enriched' : 'Standard PDF Scrape Mode'}
        </span>
      </h2>

      <div class="progress-bar-container">
        <div class="progress-bar" style={{ width: `${progress}%` }}></div>
      </div>

      <div class="toolbar">
        <input
          type="search"
          placeholder="Filter descriptions (e.g. Paint, Drywall, Insulation)..."
          value={filterText}
          onInput={(e) => setFilterText((e.target as HTMLInputElement).value)}
        />

        <div class="category-assign-box">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory((e.target as HTMLSelectElement).value)}
          >
            <option value="">-- Select Trade --</option>
            {PRESET_CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Code"
            style={{ width: '75px', textTransform: 'uppercase' }}
            maxLength={3}
            value={customCategory}
            onInput={(e) => setCustomCategory((e.target as HTMLInputElement).value)}
          />
          <button type="button" class="btn" onClick={handleApplyCategory}>
            Apply to Selected
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label>
          <input
            type="checkbox"
            checked={
              visibleUnmapped.length > 0 &&
              visibleUnmapped.every((d) => selectedDescriptions.has(d))
            }
            onChange={(e) => handleToggleSelectAll((e.target as HTMLInputElement).checked)}
          />{' '}
          Select All Visible Unmapped Items
        </label>
      </div>

      <div class="section-title">
        <span>Pending Unmapped Descriptions</span>
        <span>{unmapped.length} items</span>
      </div>
      <ul class="desc-list">
        {visibleUnmapped.map((desc, idx) => {
          const isSelected = selectedDescriptions.has(desc);
          return (
            <li
              key={desc}
              class={`desc-item ${isSelected ? 'selected' : ''}`.trim()}
              onClick={(e) => handleItemClick(desc, idx, e)}
            >
              <input type="checkbox" checked={isSelected} />
              <span class="desc-text">{desc}</span>
              <span class="cat-badge">UNMAPPED</span>
            </li>
          );
        })}
      </ul>

      <div class="section-title" style={{ marginTop: '24px' }}>
        <span>Mapped Descriptions (Sunk to Bottom)</span>
        <span>{mapped.length} items</span>
      </div>
      <ul class="desc-list">
        {visibleMapped.map((desc) => (
          <li key={desc} class="desc-item">
            <span class="desc-text">{desc}</span>
            <span class="cat-badge mapped">{model.categoryMappings.get(desc)}</span>
          </li>
        ))}
      </ul>

      <br />
      <button
        type="button"
        class="btn"
        style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}
        disabled={!canExport}
        onClick={handleExport}
      >
        Generate & Download Native ESX File
      </button>

      <div
        class="status-msg"
        style={{ color: statusMsg ? statusMsg.color : 'var(--text-muted)' }}
      >
        {statusMsg
          ? statusMsg.text
          : !hasSettings
          ? 'Fill in Project ID, Customer Name, and Material Tax Rate in Step 1 to enable export.'
          : !isFullyMapped
          ? 'Map remaining descriptions to trade categories above to enable export.'
          : 'Estimate is 100% mapped and ready to export.'}
      </div>
    </div>
  );
};