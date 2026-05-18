import { useState } from 'https://esm.sh/preact/hooks';
import { html } from '../../modules/lib.js';

// Pass the helper function as a prop or keep it globally accessible
export function CopyCell({ copyText, copyTextToClipboard }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    copyTextToClipboard(copyText, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    });
  };

  return html`
    <td>
      <button class="copy-button" onClick=${handleCopy}>
        ${copied ? "Copied!" : "Copy"}
      </button>
    </td>
  `;
}