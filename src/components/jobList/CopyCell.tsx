import { useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';

interface CopyCellProps {
  copyText: string;
  copyTextToClipboard: (text: string) => void;
}

export const CopyCell: FunctionalComponent<CopyCellProps> = ({
  copyText,
  copyTextToClipboard,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    copyTextToClipboard(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  return (
    <td class="copy-button-cell">
      <button type="button" class="copy-button" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </td>
  );
};