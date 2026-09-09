import { useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import type { ColumnMapping } from '../types';

interface Step2Props {
  headers: string[];
  mapping: ColumnMapping;
  onConfirm: (verifiedMapping: ColumnMapping) => void;
}

const REQUIRED_CORE_KEYS: (keyof ColumnMapping)[] = [
  'group',
  'lineNum',
  'description',
  'quantity',
  'unit',
  'tax',
  'rcv',
];

export const Step2ColumnVerify: FunctionalComponent<Step2Props> = ({
  headers,
  mapping,
  onConfirm,
}) => {
  const [currentMapping, setCurrentMapping] = useState<ColumnMapping>({ ...mapping });

  const handleChange = (key: keyof ColumnMapping, value: string) => {
    setCurrentMapping((prev) => ({
      ...prev,
      [key]: value || null,
    }));
  };

  const handleConfirm = () => {
    const missing = REQUIRED_CORE_KEYS.some((k) => !currentMapping[k]);
    if (missing) {
      alert('Please map all required columns before proceeding.');
      return;
    }
    onConfirm(currentMapping);
  };

  return (
    <div class="card" id="viewStep2">
      <h2>2. Verify Required CSV Columns</h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
        Please verify the mapping for the core required columns:
      </p>

      <div class="grid-2" style={{ marginTop: '16px' }}>
        {REQUIRED_CORE_KEYS.map((key) => (
          <div key={key}>
            <label>{key.toUpperCase()}</label>
            <select
              value={currentMapping[key] || ''}
              onChange={(e) => handleChange(key, (e.target as HTMLSelectElement).value)}
            >
              <option value="">-- Choose Column --</option>
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <br />
      <button type="button" class="btn" onClick={handleConfirm}>
        Confirm Columns & Continue
      </button>
    </div>
  );
};