import { DOMTreeInspector } from './rich-text-notes/DOMTreeInspector';
import { parseTemplateIntoBlocks, showTemplateDialog, templates } from './rich-text-notes/templates';
import { HostEnvironment } from './rich-text-notes/types';
import stylesheetText from './styles/rich-text-notes.css?inline';

(function initRichTextNotes(): void {
  let subjectPrefixGlobal: string | null = null;
  let appendCode: (code: string) => void = () => {
    console.error('appendCode not yet initialized.');
  };

  function setupHostEnvironment(): HostEnvironment | null {
    const wrapper = document.getElementById('RadWindowWrapper_ctl00_ContentPlaceHolder1_RadWindow_Common');
    if (!wrapper) {
      console.error('Top-level wrapper #RadWindowWrapper... not found. Ensure the modal is open.');
      return null;
    }

    wrapper.style.removeProperty('position');
    wrapper.style.removeProperty('width');
    wrapper.style.removeProperty('height');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '2em';
    wrapper.style.bottom = '2em';
    wrapper.style.right = '2em';
    wrapper.style.left = '2em';
    wrapper.style.maxWidth = 'calc(100vw - 4em)';
    wrapper.style.boxSizing = 'border-box';

    const table = wrapper.querySelector<HTMLTableElement>('table.rwTable');
    if (table) {
      table.style.removeProperty('height');
    }

    const iframe = wrapper.querySelector('iframe');
    if (!iframe || !iframe.contentDocument || !iframe.contentWindow) {
      console.error('IFrame or IFrame content not accessible.');
      return null;
    }

    const iframeDoc = iframe.contentDocument;
    const iframeWin = iframe.contentWindow;

    const style = iframeDoc.createElement('style');
    style.textContent = `
      .rwTable {
        height: 100% !important;
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;
        border-collapse: collapse;
      }
    `;
    iframeDoc.head.appendChild(style);

    return {
      doc: iframeDoc,
      win: iframeWin
    };
  }

  const hostEnv = setupHostEnvironment();
  if (!hostEnv) return;

  const { doc: iframeDoc, win: iframeWin } = hostEnv;
  const originalTextareaSelector = 'textarea[name="AddNotesUserControl$body"]';
  const originalTextarea = iframeDoc.querySelector<HTMLTextAreaElement>(originalTextareaSelector);

  if (!originalTextarea) {
    console.error(`Target note textarea not found inside iframe (Expected selector: ${originalTextareaSelector}).`);
    return;
  }

  (function setupEditor(sourceEl: HTMLTextAreaElement, doc: Document, win: Window): void {
    sourceEl.id = 'TemplateSource';

    let domInspector: DOMTreeInspector | null = null;
    const sanitizedRoot = doc.createElement('div');

    const toast = doc.createElement('div');
    toast.id = 'char-limit-warning';
    toast.textContent = 'WARNING: The note is too long and may be truncated, causing data loss. Please shorten the content.';
    doc.body.appendChild(toast);

    const subjectInput = doc.querySelector<HTMLInputElement>('input[name="AddNotesUserControl$SubjectLine"]');
    const visibilityInput = doc.querySelector<HTMLInputElement>('input[name="AddNotesUserControl$VisibilityControl$radCombo_ObjectOwnershipType"]');

    function isPreviousSiblingBlock(element: Node): boolean {
      const sibling = element.previousSibling;
      if (!sibling) return true;
      if (sibling.nodeType !== Node.ELEMENT_NODE) return false;

      const display = win.getComputedStyle(sibling as Element).display;
      return display === 'block' || display === 'flex' || display === 'grid' || sibling.nodeName === 'BR';
    }

    function cleanHtml(nodes: Node[]): string {
      let htmlString = nodes
        .map((node) => {
          let text = '';
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.nodeName;

            if (tag === 'DIV' || tag === 'P' || /^H[1-6]$/.test(tag)) {
              if (!isPreviousSiblingBlock(node)) {
                text += '<br>';
              }
              text += cleanHtml([...el.childNodes]);
              if (!text.endsWith('<br>')) {
                text += '<br>';
              }
            } else if (tag === 'STRONG') {
              text += '<b>' + cleanHtml([...el.childNodes]) + '</b>';
            } else if (tag === 'EM') {
              text += '<i>' + cleanHtml([...el.childNodes]) + '</i>';
            } else if (tag === 'B' || tag === 'I' || tag === 'U') {
              text += `<${tag.toLowerCase()}>` + cleanHtml([...el.childNodes]) + `</${tag.toLowerCase()}>`;
            } else if (tag === 'TABLE' || tag === 'UL' || tag === 'OL') {
              if (!isPreviousSiblingBlock(node)) {
                text += '<br>';
              }
              text += el.outerHTML;
              if (!text.endsWith('<br>')) {
                text += '<br>';
              }
            } else if (tag === 'BR') {
              text += '<br>';
            } else {
              text += el.outerHTML;
            }
          } else if (node.nodeType === Node.TEXT_NODE) {
            text = (node.textContent || '').replace(/\r\n?|\n/g, '<br>');
          }
          return text;
        })
        .join('');

      htmlString = htmlString.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');
      return htmlString;
    }

    function updateCharCounter(textarea: HTMLTextAreaElement, counterElement: HTMLElement, limit: number = Infinity): void {
      const count = textarea.value.length;
      if (limit !== Infinity) {
        counterElement.textContent = `Character Count: ${count} / ${limit}`;
        if (count > limit) {
          counterElement.style.color = 'red';
          counterElement.style.fontWeight = 'bold';
        } else {
          counterElement.style.color = '#333';
          counterElement.style.fontWeight = 'normal';
        }
      } else {
        counterElement.textContent = `Character Count: ${count}`;
        counterElement.style.color = '#333';
        counterElement.style.fontWeight = 'normal';
      }
    }

    const updateEditorFromSource = (): void => {
      const sourceTextarea = doc.getElementById('TemplateSource') as HTMLTextAreaElement | null;
      const editableContent = doc.getElementById('editable-content');
      const counter = doc.getElementById('char-counter');

      if (sourceTextarea && editableContent && sourceTextarea.value !== editableContent.innerHTML) {
        editableContent.innerHTML = sourceTextarea.value;
      }
      if (sourceTextarea) {
        sanitizedRoot.innerHTML = sourceTextarea.value;
      }
      if (domInspector) {
        domInspector.setTarget(sanitizedRoot);
        domInspector.render();
      }
      if (sourceTextarea && counter) {
        updateCharCounter(sourceTextarea, counter);
      }
    };

    const updateSourceFromEditor = (fromInspector = false): void => {
      const sourceTextarea = doc.getElementById('TemplateSource') as HTMLTextAreaElement | null;
      const editableContent = doc.getElementById('editable-content');
      const counter = doc.getElementById('char-counter');
      const toastEl = doc.getElementById('char-limit-warning');

      const submitButton1 = doc.getElementById('AddNotesUserControl_AddButton2') as HTMLButtonElement | null;
      const submitButton2 = doc.getElementById('AddNotesUserControl_AddButton') as HTMLButtonElement | null;

      const currentVis = doc.querySelector<HTMLInputElement>('input[name="AddNotesUserControl$VisibilityControl$radCombo_ObjectOwnershipType"]');
      const isPublic = currentVis && currentVis.value === 'Public';
      const LIMIT = isPublic ? 3700 : Infinity;

      if (fromInspector) {
        const newHtml = sanitizedRoot.innerHTML;
        if (sourceTextarea && sourceTextarea.value !== newHtml) {
          sourceTextarea.value = newHtml;
        }
        if (editableContent && editableContent.innerHTML !== newHtml) {
          editableContent.innerHTML = newHtml;
        }

        const isOverLimit = newHtml.length > LIMIT;
        if (toastEl) toastEl.style.display = isOverLimit ? 'block' : 'none';
        if (submitButton1) submitButton1.disabled = isOverLimit;
        if (submitButton2) submitButton2.disabled = isOverLimit;

        if (sourceTextarea && counter) {
          updateCharCounter(sourceTextarea, counter, LIMIT);
        }
        return;
      }

      if (sourceTextarea && editableContent) {
        const cleanedHtml = cleanHtml([...editableContent.childNodes]);
        const isOverLimit = cleanedHtml.length > LIMIT;

        if (toastEl) toastEl.style.display = isOverLimit ? 'block' : 'none';
        if (submitButton1) submitButton1.disabled = isOverLimit;
        if (submitButton2) submitButton2.disabled = isOverLimit;

        if (sourceTextarea.value !== cleanedHtml) {
          sourceTextarea.value = cleanedHtml;
        }

        sanitizedRoot.innerHTML = cleanedHtml;
        if (domInspector) {
          domInspector.setTarget(sanitizedRoot);
          domInspector.render();
        }
      }

      if (sourceTextarea && counter) {
        updateCharCounter(sourceTextarea, counter, LIMIT);
      }
    };

    appendCode = (code: string): void => {
      const sourceTextarea = doc.getElementById('TemplateSource') as HTMLTextAreaElement | null;
      if (sourceTextarea) {
        sourceTextarea.value += (sourceTextarea.value.length !== 0 ? '<br>' : '') + code;
        updateEditorFromSource();

        if (subjectPrefixGlobal && subjectInput) {
          const currentSubject = subjectInput.value;
          const subjectLinePrefix = 'Email from PCC Cleaning & Restoration for:';
          if (currentSubject.startsWith(subjectLinePrefix)) {
            const originalName = currentSubject.substring(subjectLinePrefix.length).trim();
            subjectInput.value = `${subjectPrefixGlobal} for: ${originalName}`;
          }
          subjectPrefixGlobal = null;
        }
      }
    };

    const originalRow = sourceEl.closest('tr');
    const originalCell = sourceEl.closest('td');

    if (!originalRow || !originalCell) {
      console.error('Original textarea is not contained in a standard table row/cell.');
      return;
    }

    // Inject bundled CSS stylesheet directly into the host iframe head
    const customStyle = doc.createElement('style');
    customStyle.textContent = stylesheetText;
    doc.head.appendChild(customStyle);

    const newRow = doc.createElement('tr');
    newRow.innerHTML = `
      <td style="vertical-align: top; font-size: 11px; font-weight: bold; padding: 8px;">Template/Editor:</td>
      <td style="padding: 8px; width: 100%; max-width: 0; overflow: hidden; box-sizing: border-box;">
        <div id="template-controls">
          <label for="template-selector">Choose Template:</label>
          <select id="template-selector"></select>
        </div>

        <div class="editor-split-container">
          <div id="editable-wrapper">
            <label style="display: block; font-size: 11px; font-weight: bold; margin-bottom: 4px; flex-shrink: 0;">Formatted Note</label>
            <div id="editor-container">
              <div id="custom-toolbar">
                <span class="custom-cmd-btn" data-cmd="bold" title="Bold">B</span>
                <span class="custom-cmd-btn" data-cmd="italic" title="Italic">I</span>
                <span class="custom-cmd-btn" data-cmd="underline" title="Underline">U</span>
                <span class="custom-cmd-btn" data-cmd="insertUnorderedList" title="Unordered List">&#x2022;</span>
                <span class="custom-cmd-btn" data-cmd="insertOrderedList" title="Ordered List">1.</span>
                <span class="custom-cmd-btn" data-cmd="insertHorizontalRule" title="Horizontal Rule">—</span>
                <span class="custom-cmd-btn" data-cmd="indent" title="Increase Indent">&gt;&gt;</span>
                <span class="custom-cmd-btn" data-cmd="outdent" title="Decrease Indent">&lt;&lt;</span>
              </div>
              <div id="editable-content" contenteditable="true"></div>
            </div>
          </div>

          <div id="source-wrapper">
            <div class="inspector-header">
              <label id="inspector-title" style="font-size: 11px; font-weight: bold; margin: 0;">DOM Inspector (Elements)</label>
              <div class="inspector-tabs">
                <span id="tab-dom-tree" class="inspector-tab-btn active" title="DOM Tree Inspector">DOM Tree</span>
                <span id="tab-raw-html" class="inspector-tab-btn" title="Raw HTML View">Raw HTML</span>
              </div>
            </div>
            <div id="source-elements">
              <div id="dom-inspector-container"></div>
            </div>
            <div id="char-counter" style="font-size: 11px; margin-top: 4px; text-align: right;">Character Count: 0</div>
          </div>
        </div>
      </td>
    `;

    originalRow.parentNode?.replaceChild(newRow, originalRow);

    const sourceElementsDiv = newRow.querySelector('#source-elements') as HTMLElement;
    const domContainer = newRow.querySelector('#dom-inspector-container') as HTMLElement;
    sourceElementsDiv.appendChild(sourceEl);
    sourceEl.style.display = 'none';

    const editableContentDiv = doc.getElementById('editable-content') as HTMLElement;

    try {
      doc.execCommand('styleWithCSS', false, 'false');
      doc.execCommand('defaultParagraphSeparator', false, 'br');
    } catch {
      // Ignored for environments with restricted execCommand overrides
    }

    editableContentDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doc.execCommand('insertLineBreak');
      }
    });

    domInspector = new DOMTreeInspector(domContainer, {
      doc,
      targetElement: sanitizedRoot,
      onChange: () => updateSourceFromEditor(true)
    });

    const tabDomTree = newRow.querySelector('#tab-dom-tree') as HTMLElement;
    const tabRawHtml = newRow.querySelector('#tab-raw-html') as HTMLElement;

    tabDomTree.addEventListener('click', () => {
      tabDomTree.classList.add('active');
      tabRawHtml.classList.remove('active');
      domContainer.style.display = 'block';
      sourceEl.style.display = 'none';
      updateEditorFromSource();
    });

    tabRawHtml.addEventListener('click', () => {
      tabRawHtml.classList.add('active');
      tabDomTree.classList.remove('active');
      domContainer.style.display = 'none';
      sourceEl.style.display = 'block';
      updateSourceFromEditor();
    });

    const toolbar = doc.getElementById('custom-toolbar') as HTMLElement;
    toolbar.querySelectorAll<HTMLSpanElement>('.custom-cmd-btn').forEach((span) => {
      const command = span.getAttribute('data-cmd');
      if (command) {
        span.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          updateEditorFromSource();
          doc.execCommand(command, false, undefined);
          doc.getElementById('editable-content')?.focus();
          updateSourceFromEditor();
        });
      }
    });

    updateEditorFromSource();

    if (visibilityInput) {
      visibilityInput.addEventListener('change', () => updateSourceFromEditor());
      updateSourceFromEditor();
    }

    editableContentDiv.addEventListener('input', () => updateSourceFromEditor());
    sourceEl.addEventListener('input', () => updateEditorFromSource());

    const charCounterElement = newRow.querySelector('#char-counter') as HTMLElement;
    updateCharCounter(sourceEl, charCounterElement);

    const templateSelector = newRow.querySelector('#template-selector') as HTMLSelectElement;
    const defaultOption = doc.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select template';
    defaultOption.selected = true;
    defaultOption.disabled = true;
    templateSelector.appendChild(defaultOption);

    Object.keys(templates).forEach((key) => {
      const template = templates[key];
      const option = doc.createElement('option');
      option.value = key;
      option.textContent = template.text;
      templateSelector.appendChild(option);
    });

    templateSelector.addEventListener('change', () => {
      const selectedKey = templateSelector.value;
      if (selectedKey) {
        const templateData = templates[selectedKey];
        const parsedBlocks = parseTemplateIntoBlocks(templateData.code);
        templateSelector.value = '';
        showTemplateDialog(parsedBlocks, templateData, (finalOutput, prefix) => {
          if (prefix !== undefined) {
            subjectPrefixGlobal = prefix;
          }
          appendCode(finalOutput);
          templateSelector.value = '';
        });
      }
    });
  })(originalTextarea, iframeDoc, iframeWin);
})();