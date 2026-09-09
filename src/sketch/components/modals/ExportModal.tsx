import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { store } from '../../state';
import { generateXML } from '../../exporters/xactimateXml';
import { downloadSKX, downloadRawXml } from '../../exporters/skxArchive';
import { Modal } from './Modal';

export function ExportModal() {
  const [xmlContent, setXmlContent] = useState('');
  const [templateName, setTemplateName] = useState(store.filename);

  useEffect(() => {
    const xml = generateXML(store.shapes, store.levels, store.wallMetadataList, store.openingDefaults);
    setXmlContent(xml);
  }, []);

  const close = () => {
    store.activeModal = null;
    store.notify();
  };

  const handleCopyXml = () => {
    navigator.clipboard.writeText(xmlContent);
    alert('Document XML copied to clipboard.');
  };

  return (
    <Modal title="Export Multi-Floor Xactimate Document (.SKX)" width="860px" onClose={close}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
        <div class="field" style={{ flex: 1, marginBottom: 0 }}>
          <label>Template File Name</label>
          <input
            type="text"
            value={templateName}
            onInput={(e) => {
              const val = (e.target as HTMLInputElement).value;
              setTemplateName(val);
              store.filename = val;
            }}
          />
        </div>
        <button
          class="btn"
          style={{ padding: '8px 18px', fontSize: '0.85rem' }}
          onClick={() => downloadSKX(templateName, xmlContent)}
        >
          📦 Download .SKX Template
        </button>
      </div>
      <textarea readOnly value={xmlContent} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
        <button class="btn btn-secondary btn-sm" onClick={handleCopyXml}>Copy XML</button>
        <button class="btn btn-secondary btn-sm" onClick={() => downloadRawXml('Sketch.xml', xmlContent)}>Download Sketch.xml</button>
        <button class="btn btn-secondary btn-sm" onClick={() => downloadRawXml('XACTDOC.XML', xmlContent)}>Download XACTDOC.XML</button>
      </div>
    </Modal>
  );
}