import JSZip from 'jszip';

export async function downloadSKX(baseFilename: string, xmlContent: string): Promise<void> {
  if (!xmlContent) return;

  const sanitizedBase = (baseFilename || 'Template').trim().replace(/[^A-Za-z0-9_\-\s]/g, '') || 'Template';
  const filename = `${sanitizedBase}.skx`;

  const zip = new JSZip();
  zip.file('XACTDOC.XML', xmlContent);

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  triggerFileDownload(blob, filename);
}

export function downloadRawXml(filename: string, content: string): void {
  if (!content) return;
  const blob = new Blob([content], { type: 'text/xml;charset=utf-8' });
  triggerFileDownload(blob, filename);
}

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}