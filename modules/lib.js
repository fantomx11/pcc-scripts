const { h, render } = await import('https://esm.sh/preact');
const { default: htm } = await import('https://esm.sh/htm');

export const html = htm.bind(h);

export const isDate = (d) => !isNaN(new Date(d).getTime());

export const formatDateForInput = (dateStr) => {
  if (!dateStr || dateStr === "null") return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split('T')[0];
};

export function getDaysSince(dateStr) {
  if (!dateStr || String(dateStr).toLowerCase().includes("null") || dateStr === "") return Infinity;
  const diff = Math.floor((new Date() - new Date(dateStr)) / 864e5);
  return isNaN(diff) || diff < 0 ? 0 : diff;
}

export function parseCurrency(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;
}

export function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      console.log(`Copied Job Number: ${text}`);
    }).catch(err => fallbackCopyTextToClipboard(text));
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand("copy"); } catch (err) { }
    document.body.removeChild(textArea);
  }
}

export function camelToCapitalCase(str) {
  if (!str) return "";
  
  // 1. Insert a space before all caps
  const spaced = str.replace(/([A-Z])/g, " $1");
  
  // 2. Capitalize the first letter and trim any accidental leading spaces
  return (spaced.charAt(0).toUpperCase() + spaced.slice(1)).trim();
}

export function parsePercentage(input, toDecimal = true) {
  if (typeof input !== 'string') return NaN;

  // Remove whitespace and the percentage symbol
  const cleaned = input.trim().replace('%', '');
  
  // Convert to a floating-point number
  const value = parseFloat(cleaned);

  // Return NaN if parseFloat failed to extract a valid number
  if (isNaN(value)) return NaN;

  return toDecimal ? value / 100 : value;
}