import { h } from 'preact';
import htm from 'htm';

export const html = htm.bind(h);

export const isDate = (d?: string | Date | number | null): boolean => {
  if (!d || d === 'null') return false;
  return !isNaN(new Date(d).getTime());
};

export const formatDateForInput = (dateStr?: string | Date | null): string => {
  if (!dateStr || dateStr === 'null') return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

export function getDaysSince(dateStr?: string | Date | null): number {
  if (!dateStr || String(dateStr).toLowerCase().includes('null') || dateStr === '') {
    return Infinity;
  }
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 864e5);
  return isNaN(diff) || diff < 0 ? 0 : diff;
}

export function parseCurrency(val?: string | number | null): number {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0;
}

export function copyTextToClipboard(text: string): void {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      console.log(`Copied Job Number: ${text}`);
    }).catch(() => fallbackCopyTextToClipboard(text));
  } else {
    fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text: string): void {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Failed to copy text:', err);
  }
  document.body.removeChild(textArea);
}

export function camelToCapitalCase(str?: string): string {
  if (!str) return '';
  const spaced = str.replace(/([A-Z])/g, ' $1');
  return (spaced.charAt(0).toUpperCase() + spaced.slice(1)).trim();
}

export function parsePercentage(input?: string | number | null, toDecimal = true): number {
  if (input === null || input === undefined) return NaN;
  if (typeof input === 'number') return toDecimal ? input / 100 : input;
  const cleaned = input.trim().replace('%', '');
  const value = parseFloat(cleaned);
  if (isNaN(value)) return NaN;
  return toDecimal ? value / 100 : value;
}