import { useRef, useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import type { EstimateModel } from '../models/EstimateModel';
import { CsvParser } from '../parsers/CsvParser';
import { ColumnMapper } from '../parsers/ColumnMapper';
import { TaxRateDetector } from '../parsers/TaxRateDetector';
import type { ColumnMapping } from '../types';

interface Step1Props {
  model: EstimateModel;
  onModelChange: () => void;
  onCsvLoaded: (
    headers: string[],
    dataRows: string[][],
    mapping: ColumnMapping,
    isComplete: boolean,
    isEnriched: boolean
  ) => void;
}

export const Step1ProjectUpload: FunctionalComponent<Step1Props> = ({
  model,
  onModelChange,
  onCsvLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleFile = (file: File) => {
    setStatusMsg({ text: `Processing: ${file.name}...` });
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { headers, dataRows } = CsvParser.parse(text);
        const { mapping, isComplete, isEnriched } = ColumnMapper.detect(headers, dataRows);

        const detectedTax = TaxRateDetector.detect(headers, dataRows, mapping);
        if (detectedTax) {
          model.setTaxRate(detectedTax.rate);
          onModelChange();
          setStatusMsg({
            text: `Loaded: ${file.name} (${dataRows.length} items) • Auto-detected Tax Rate: ${detectedTax.rate.toFixed(3)}% (${detectedTax.method})`,
          });
        } else {
          setStatusMsg({ text: `Loaded: ${file.name} (${dataRows.length} items)` });
        }

        onCsvLoaded(headers, dataRows, mapping, isComplete, isEnriched);
      } catch (err: any) {
        setStatusMsg({ text: `CSV parse error: ${err.message}`, isError: true });
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div class="card" id="viewStep1">
      <h2>1. Project Details & Estimate Upload</h2>

      <div class="grid-3" style={{ marginBottom: '16px' }}>
        <div>
          <label for="inputProjectId">
            Project ID (Max 20 Caps) <span class="required-star">*</span>
          </label>
          <input
            type="text"
            id="inputProjectId"
            maxLength={20}
            placeholder="e.g. 260904_CLAIM"
            style={{ textTransform: 'uppercase' }}
            value={model.projectId}
            onInput={(e) => {
              model.setProjectId((e.target as HTMLInputElement).value);
              onModelChange();
            }}
          />
        </div>
        <div>
          <label for="inputCustomerName">
            Customer Name <span class="required-star">*</span>
          </label>
          <input
            type="text"
            id="inputCustomerName"
            placeholder="e.g. John Doe"
            value={model.customerName}
            onInput={(e) => {
              model.setCustomerName((e.target as HTMLInputElement).value);
              onModelChange();
            }}
          />
        </div>
        <div>
          <label for="inputTaxRate">
            Material Tax Rate (%) <span class="required-star">*</span>
          </label>
          <input
            type="number"
            id="inputTaxRate"
            step="0.001"
            placeholder="e.g. 8.917"
            value={model.salesTaxRate !== null ? model.salesTaxRate : ''}
            onInput={(e) => {
              model.setTaxRate((e.target as HTMLInputElement).value);
              onModelChange();
            }}
          />
        </div>
      </div>

      <div class="preview-box">
        <strong>Target ESX Filename: </strong>
        <span>{model.getFormattedFilename()}</span>
      </div>

      <div
        class={`drop-zone ${isDragOver ? 'drag-over' : ''}`.trim()}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer?.files?.length) {
            handleFile(e.dataTransfer.files[0]);
          }
        }}
      >
        <div style={{ fontSize: '36px', marginBottom: '8px' }}>📄</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>Drag & Drop Adjuster CSV File Here</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Supports minimal PDF scrapes & native Xactimate exports
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files?.length) handleFile(files[0]);
          }}
        />
        {statusMsg && (
          <div
            style={{
              marginTop: '12px',
              fontWeight: 600,
              color: statusMsg.isError ? 'var(--error)' : 'var(--primary)',
            }}
          >
            {statusMsg.text}
          </div>
        )}
      </div>
    </div>
  );
};