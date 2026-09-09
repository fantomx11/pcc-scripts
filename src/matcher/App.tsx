import { useState, useReducer } from 'preact/hooks';
import { EstimateModel } from './models/EstimateModel';
import { LineItem } from './models/LineItem';
import { Step1ProjectUpload } from './components/Step1ProjectUpload';
import { Step2ColumnVerify } from './components/Step2ColumnVerify';
import { Step3CategoryQueue } from './components/Step3CategoryQueue';
import type { ColumnMapping } from './types';

export const App = () => {
  const [model] = useState<EstimateModel>(() => new EstimateModel());
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [activeMapping, setActiveMapping] = useState<ColumnMapping | null>(null);

  const buildEstimateModel = (headers: string[], rows: string[][], mapping: ColumnMapping) => {
    const getIdx = (colName: string | null) => (colName ? headers.indexOf(colName) : -1);

    const idx = {
      group: getIdx(mapping.group),
      groupCode: getIdx(mapping.groupCode),
      lineNum: getIdx(mapping.lineNum),
      description: getIdx(mapping.description),
      quantity: getIdx(mapping.quantity),
      unit: getIdx(mapping.unit),
      tax: getIdx(mapping.tax),
      rcv: getIdx(mapping.rcv),
      gcop: getIdx(mapping.gcop),
      itemAmount: getIdx(mapping.itemAmount),
      unitPrice: getIdx(mapping.unitPrice),
      category: getIdx(mapping.category),
      selector: getIdx(mapping.selector),
      activity: getIdx(mapping.activity),
      material: getIdx(mapping.material),
      wage: getIdx(mapping.wage),
      burden: getIdx(mapping.burden),
      overhead: getIdx(mapping.overhead),
      equipment: getIdx(mapping.equipment),
      market: getIdx(mapping.market),
      note: getIdx(mapping.note),
    };

    model.items = [];
    rows.forEach((row, i) => {
      const item = new LineItem({
        group: idx.group !== -1 ? row[idx.group] : 'General',
        groupCode: idx.groupCode !== -1 ? row[idx.groupCode] : '',
        lineNum: idx.lineNum !== -1 ? row[idx.lineNum] : i + 1,
        description: idx.description !== -1 ? row[idx.description] : '',
        quantity: idx.quantity !== -1 ? row[idx.quantity] : 1,
        unit: idx.unit !== -1 ? row[idx.unit] : 'EA',
        tax: idx.tax !== -1 ? row[idx.tax] : 0,
        rcv: idx.rcv !== -1 ? row[idx.rcv] : 0,
        gcop: idx.gcop !== -1 ? row[idx.gcop] : null,
        itemAmount: idx.itemAmount !== -1 ? row[idx.itemAmount] : null,
        unitPrice: idx.unitPrice !== -1 ? row[idx.unitPrice] : null,
        category: idx.category !== -1 ? row[idx.category] : '',
        selector: idx.selector !== -1 ? row[idx.selector] : 'MISC',
        activity: idx.activity !== -1 ? row[idx.activity] : '+',
        material: idx.material !== -1 ? row[idx.material] : null,
        wage: idx.wage !== -1 ? row[idx.wage] : null,
        burden: idx.burden !== -1 ? row[idx.burden] : null,
        overhead: idx.overhead !== -1 ? row[idx.overhead] : null,
        equipment: idx.equipment !== -1 ? row[idx.equipment] : 0,
        market: idx.market !== -1 ? row[idx.market] : 0,
        note: idx.note !== -1 ? row[idx.note] : '',
      });

      model.addLineItem(item);
    });

    forceUpdate();
  };

  const handleCsvLoaded = (
    headers: string[],
    dataRows: string[][],
    mapping: ColumnMapping,
    isComplete: boolean,
    isEnriched: boolean
  ) => {
    setCsvHeaders(headers);
    setCsvRows(dataRows);
    setActiveMapping(mapping);
    model.isEnrichedSource = isEnriched;

    if (isComplete) {
      buildEstimateModel(headers, dataRows, mapping);
      setCurrentStep(3);
    } else {
      setCurrentStep(2);
    }
  };

  const handleColumnConfirm = (verifiedMapping: ColumnMapping) => {
    setActiveMapping(verifiedMapping);
    buildEstimateModel(csvHeaders, csvRows, verifiedMapping);
    setCurrentStep(3);
  };

  return (
    <div class="container">
      <header>
        <h1>Xactimate Estimate Rebuilder</h1>
        <p class="subtitle">Unified Ingestion Engine • Auto-Enrichment • Native ESX Exporter</p>
      </header>

      <Step1ProjectUpload
        model={model}
        onModelChange={forceUpdate}
        onCsvLoaded={handleCsvLoaded}
      />

      {currentStep === 2 && activeMapping && (
        <Step2ColumnVerify
          headers={csvHeaders}
          mapping={activeMapping}
          onConfirm={handleColumnConfirm}
        />
      )}

      {currentStep === 3 && (
        <Step3CategoryQueue
          model={model}
          onModelChange={forceUpdate}
        />
      )}
    </div>
  );
};