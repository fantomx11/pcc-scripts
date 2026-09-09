import { h } from 'preact';
import { store } from '../../state';
import { DefaultsModal } from './DefaultsModal';
import { CeilingWarningModal } from './CeilingWarningModal';
import { InteriorWindowModal } from './InteriorWindowModal';
import { DeductWarningModal } from './DeductWarningModal';
import { ImportModal } from './ImportModal';
import { ExportModal } from './ExportModal';
import { SplitConfirmModal } from './SplitConfirmModal';
import { getAllCeilingViolations } from '../../validators/ceilingValidator';
import { getInteriorWindowViolations } from '../../validators/interiorWindowValidator';
import { hasUnsetDeductions } from '../../validators/deductionValidator';

export function Modals({ onRedraw }: { onRedraw: () => void }) {
  const triggerExport = (force = false) => {
    if (!force) {
      if (getAllCeilingViolations(store.shapes, store.levels, store.wallMetadataList).length > 0) {
        store.activeModal = 'ceilingWarning';
        store.notify();
        return;
      }
      if (getInteriorWindowViolations(store.shapes, store.levels, store.wallMetadataList).length > 0) {
        store.activeModal = 'interiorWindow';
        store.notify();
        return;
      }
      if (hasUnsetDeductions(store.openingDefaults, store.wallMetadataList)) {
        store.activeModal = 'deductWarning';
        store.notify();
        return;
      }
    }
    store.activeModal = 'export';
    store.notify();
  };

  if (store.splitState.pendingData) {
    return <SplitConfirmModal onRedraw={onRedraw} />;
  }

  switch (store.activeModal) {
    case 'defaults':
      return <DefaultsModal onExportResume={() => triggerExport(true)} />;
    case 'ceilingWarning':
      return <CeilingWarningModal onProceed={() => triggerExport(true)} />;
    case 'interiorWindow':
      return <InteriorWindowModal onProceedExport={() => triggerExport(true)} onRedraw={onRedraw} />;
    case 'deductWarning':
      return <DeductWarningModal onProceed={() => triggerExport(true)} />;
    case 'import':
      return <ImportModal onRedraw={onRedraw} />;
    case 'export':
      return <ExportModal />;
    default:
      return null;
  }
}