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
