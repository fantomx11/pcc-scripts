import { DOMTreeInspectorOptions } from './types';

export class DOMTreeInspector {
  private container: HTMLElement;
  private doc: Document;
  private targetElement: HTMLElement | null;
  private onChange: () => void;
  private isEditing = false;
  private collapsedNodes = new WeakSet<Node>();
  private readonly voidTags = new Set<string>([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
  ]);
  private draggedNode: Node | null = null;

  constructor(container: HTMLElement, options: DOMTreeInspectorOptions = {}) {
    this.container = container;
    this.doc = options.doc || document;
    this.targetElement = options.targetElement || null;
    this.onChange = options.onChange || (() => {});
    this.init();
  }

  private init(): void {
    this.container.classList.add('devtools-dom-tree');
    this.render();
  }

  public setTarget(element: HTMLElement | null): void {
    this.targetElement = element;
    if (!this.isEditing) {
      this.render();
    }
  }

  public render(): void {
    if (this.isEditing || !this.targetElement) return;
    this.container.innerHTML = '';

    if (!this.targetElement.childNodes || this.targetElement.childNodes.length === 0) {
      const emptyNotice = this.doc.createElement('div');
      emptyNotice.className = 'dom-empty-notice';
      emptyNotice.textContent = '<empty note content>';
      this.container.appendChild(emptyNotice);
      return;
    }

    Array.from(this.targetElement.childNodes).forEach((node) => {
      const nodeEl = this.buildNodeTree(node);
      if (nodeEl) this.container.appendChild(nodeEl);
    });
  }

  private buildNodeTree(node: Node): HTMLElement | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.nodeValue;
      if (!textContent || textContent.trim() === '') {
        if (!textContent || !textContent.includes('\n')) return null;
      }

      const textRow = this.doc.createElement('div');
      textRow.className = 'dom-row dom-text-node';
      textRow.draggable = true;

      const indentSpacer = this.doc.createElement('span');
      indentSpacer.className = 'dom-arrow-spacer';
      textRow.appendChild(indentSpacer);

      const textSpan = this.doc.createElement('span');
      textSpan.className = 'dom-text-content';
      textSpan.textContent = `"${textContent}"`;
      textSpan.title = 'Double-click to edit text | Drag to move';

      textSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.editInline(textSpan, textContent || '', (newVal) => {
          node.nodeValue = newVal;
          this.onChange();
          this.render();
        });
      });

      textRow.appendChild(textSpan);
      this.setupDragAndDrop(textRow, node, false);
      return textRow;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      const isVoid = this.voidTags.has(tagName);
      const hasChildren = element.childNodes.length > 0;
      const isCollapsed = this.collapsedNodes.has(element);

      const elemWrapper = this.doc.createElement('div');
      elemWrapper.className = 'dom-elem-wrapper';

      const tagRow = this.doc.createElement('div');
      tagRow.className = 'dom-row dom-tag-row';
      tagRow.draggable = true;

      const toggle = this.doc.createElement('span');
      toggle.className = 'dom-arrow' + (hasChildren && !isVoid ? ' has-children' : '');
      toggle.textContent = hasChildren && !isVoid ? (isCollapsed ? '▶' : '▼') : '';
      tagRow.appendChild(toggle);

      const lineContent = this.doc.createElement('span');
      lineContent.className = 'dom-line-content';

      const openTag = this.doc.createElement('span');
      openTag.className = 'dom-tag-start';
      openTag.innerHTML = `&lt;<span class="dom-tag-name">${tagName}</span>`;
      lineContent.appendChild(openTag);

      const tagNameSpan = openTag.querySelector('.dom-tag-name') as HTMLElement;
      tagNameSpan.title = 'Double-click to change tag name | Drag to move';
      tagNameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.editInline(tagNameSpan, tagName, (newTagName) => {
          const sanitizedTag = newTagName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
          if (sanitizedTag && sanitizedTag !== tagName) {
            try {
              const newElem = this.doc.createElement(sanitizedTag);
              Array.from(element.attributes).forEach((attr) => newElem.setAttribute(attr.name, attr.value));
              while (element.firstChild) {
                newElem.appendChild(element.firstChild);
              }
              element.parentNode?.replaceChild(newElem, element);
              this.onChange();
              this.render();
            } catch (err) {
              console.error('Invalid tag name:', err);
              this.render();
            }
          } else {
            this.render();
          }
        });
      });

      Array.from(element.attributes || []).forEach((attr) => {
        const attrSpan = this.doc.createElement('span');
        attrSpan.className = 'dom-attr-pair';
        attrSpan.innerHTML = ` <span class="dom-attr-name">${attr.name}</span>="<span class="dom-attr-val">${attr.value}</span>"`;
        attrSpan.title = 'Double-click to edit attribute (e.g. style="color:red")';

        attrSpan.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.editInline(attrSpan, `${attr.name}="${attr.value}"`, (newVal) => {
            const match = newVal.trim().match(/^([a-zA-Z0-9_-]+)(?:=(?:"|')?(.*?)(?:"|')?)?$/);
            if (match) {
              if (match[1] !== attr.name) {
                element.removeAttribute(attr.name);
              }
              element.setAttribute(match[1], match[2] !== undefined ? match[2] : '');
            } else if (!newVal.trim()) {
              element.removeAttribute(attr.name);
            }
            this.onChange();
            this.render();
          });
        });

        lineContent.appendChild(attrSpan);
      });

      const tagEnd = this.doc.createElement('span');
      tagEnd.className = 'dom-tag-end';
      tagEnd.textContent = isVoid ? ' />' : '>';
      lineContent.appendChild(tagEnd);

      const actions = this.doc.createElement('span');
      actions.className = 'dom-node-actions';
      actions.innerHTML = `
        <span class="dom-action-btn" data-action="edit-html" title="Edit as HTML">HTML</span>
        <span class="dom-action-btn" data-action="add-attr" title="Add Attribute">+attr</span>
        <span class="dom-action-btn" data-action="delete" title="Delete Node">&times;</span>
      `;
      lineContent.appendChild(actions);

      tagRow.appendChild(lineContent);
      elemWrapper.appendChild(tagRow);

      this.setupDragAndDrop(tagRow, element, !isVoid);

      actions.querySelector('[data-action="edit-html"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editAsHtml(elemWrapper, element);
      });

      actions.querySelector('[data-action="add-attr"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const attrPrompt = prompt('Enter attribute (e.g. style="color: red;" or class="my-class"):');
        if (attrPrompt) {
          const match = attrPrompt.trim().match(/^([a-zA-Z0-9_-]+)(?:=(?:"|')?(.*?)(?:"|')?)?$/);
          if (match && match[1]) {
            element.setAttribute(match[1], match[2] !== undefined ? match[2] : '');
            this.onChange();
            this.render();
          }
        }
      });

      actions.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        element.parentNode?.removeChild(element);
        this.onChange();
        this.render();
      });

      if (hasChildren && !isVoid) {
        const childrenContainer = this.doc.createElement('div');
        childrenContainer.className = 'dom-children-container';
        if (isCollapsed) {
          childrenContainer.style.display = 'none';
        }

        Array.from(element.childNodes).forEach((child) => {
          const childTree = this.buildNodeTree(child);
          if (childTree) childrenContainer.appendChild(childTree);
        });

        elemWrapper.appendChild(childrenContainer);

        const closeTagRow = this.doc.createElement('div');
        closeTagRow.className = 'dom-tag-close-row';
        if (isCollapsed) {
          closeTagRow.style.display = 'none';
        }

        const closeSpacer = this.doc.createElement('span');
        closeSpacer.className = 'dom-arrow-spacer';
        closeTagRow.appendChild(closeSpacer);

        const closeTagSpan = this.doc.createElement('span');
        closeTagSpan.className = 'dom-tag-close';
        closeTagSpan.innerHTML = `&lt;/<span class="dom-tag-name">${tagName}</span>&gt;`;
        closeTagRow.appendChild(closeTagSpan);

        elemWrapper.appendChild(closeTagRow);

        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const collapsed = childrenContainer.style.display === 'none';
          if (collapsed) {
            childrenContainer.style.display = 'block';
            closeTagRow.style.display = 'block';
            toggle.textContent = '▼';
            this.collapsedNodes.delete(element);
            const placeholder = tagRow.querySelector('.dom-collapsed-placeholder');
            if (placeholder) placeholder.remove();
          } else {
            childrenContainer.style.display = 'none';
            closeTagRow.style.display = 'none';
            toggle.textContent = '▶';
            this.collapsedNodes.add(element);
            const placeholder = this.doc.createElement('span');
            placeholder.className = 'dom-collapsed-placeholder';
            placeholder.innerHTML = `…&lt;/<span class="dom-tag-name">${tagName}</span>&gt;`;
            lineContent.insertBefore(placeholder, actions);
          }
        });
      }

      return elemWrapper;
    }

    return null;
  }

  private setupDragAndDrop(rowEl: HTMLElement, node: Node, canHaveChildren: boolean): void {
    rowEl.addEventListener('dragstart', (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (this.isEditing || target.closest('.dom-action-btn, input, textarea, .dom-arrow')) {
        e.preventDefault();
        return;
      }
      this.draggedNode = node;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      }
      rowEl.classList.add('dom-dragging');
      e.stopPropagation();
    });

    rowEl.addEventListener('dragend', () => {
      this.draggedNode = null;
      this.doc.querySelectorAll('.dom-row').forEach((el) => {
        el.classList.remove('dom-dragging', 'dom-drop-before', 'dom-drop-after', 'dom-drop-inside');
      });
    });

    rowEl.addEventListener('dragover', (e: DragEvent) => {
      if (!this.draggedNode || this.draggedNode === node) return;
      if (this.draggedNode.nodeType === Node.ELEMENT_NODE && (this.draggedNode as HTMLElement).contains(node)) return;

      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      const rect = rowEl.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const height = rect.height;

      rowEl.classList.remove('dom-drop-before', 'dom-drop-after', 'dom-drop-inside');

      if (canHaveChildren && relY > height * 0.25 && relY < height * 0.75) {
        rowEl.classList.add('dom-drop-inside');
      } else if (relY <= height * 0.5) {
        rowEl.classList.add('dom-drop-before');
      } else {
        rowEl.classList.add('dom-drop-after');
      }
    });

    rowEl.addEventListener('dragleave', () => {
      rowEl.classList.remove('dom-drop-before', 'dom-drop-after', 'dom-drop-inside');
    });

    rowEl.addEventListener('drop', (e: DragEvent) => {
      if (!this.draggedNode || this.draggedNode === node) return;
      if (this.draggedNode.nodeType === Node.ELEMENT_NODE && (this.draggedNode as HTMLElement).contains(node)) return;

      e.preventDefault();
      e.stopPropagation();

      const isBefore = rowEl.classList.contains('dom-drop-before');
      const isAfter = rowEl.classList.contains('dom-drop-after');
      const isInside = rowEl.classList.contains('dom-drop-inside');

      rowEl.classList.remove('dom-drop-before', 'dom-drop-after', 'dom-drop-inside');

      if (isInside && node.nodeType === Node.ELEMENT_NODE) {
        node.appendChild(this.draggedNode);
      } else if (isBefore && node.parentNode) {
        node.parentNode.insertBefore(this.draggedNode, node);
      } else if (isAfter && node.parentNode) {
        node.parentNode.insertBefore(this.draggedNode, node.nextSibling);
      }

      this.draggedNode = null;
      this.onChange();
      this.render();
    });
  }

  private editInline(containerEl: HTMLElement, initialValue: string, onCommit: (val: string) => void): void {
    this.isEditing = true;
    const originalContent = containerEl.innerHTML;
    const input = this.doc.createElement('input');
    input.type = 'text';
    input.className = 'dom-inline-input';
    input.value = initialValue;

    const commit = () => {
      if (!this.isEditing) return;
      this.isEditing = false;
      const val = input.value;
      onCommit(val);
    };

    const cancel = () => {
      if (!this.isEditing) return;
      this.isEditing = false;
      containerEl.innerHTML = originalContent;
      this.render();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    input.addEventListener('blur', () => {
      commit();
    });

    containerEl.innerHTML = '';
    containerEl.appendChild(input);
    input.focus();
    input.select();
  }

  private editAsHtml(wrapperEl: HTMLElement, node: Node): void {
    this.isEditing = true;
    const currentHtml = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement).outerHTML : node.nodeValue || '';

    const editorDiv = this.doc.createElement('div');
    editorDiv.className = 'dom-html-editor-container';

    const textarea = this.doc.createElement('textarea');
    textarea.className = 'dom-html-editor-textarea';
    textarea.value = currentHtml;

    const btnRow = this.doc.createElement('div');
    btnRow.className = 'dom-html-editor-buttons';

    const saveBtn = this.doc.createElement('span');
    saveBtn.className = 'dom-btn dom-btn-save';
    saveBtn.textContent = 'Save (Ctrl+Enter)';

    const cancelBtn = this.doc.createElement('span');
    cancelBtn.className = 'dom-btn dom-btn-cancel';
    cancelBtn.textContent = 'Cancel (Esc)';

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    editorDiv.appendChild(textarea);
    editorDiv.appendChild(btnRow);

    const parent = wrapperEl.parentNode;
    if (parent) {
      parent.insertBefore(editorDiv, wrapperEl);
      wrapperEl.style.display = 'none';
    }

    const commit = () => {
      if (!this.isEditing) return;
      this.isEditing = false;
      const newHtml = textarea.value;
      try {
        const tempDiv = this.doc.createElement('div');
        tempDiv.innerHTML = newHtml;
        const newNodes = Array.from(tempDiv.childNodes);
        if (node.parentNode) {
          if (newNodes.length > 0) {
            newNodes.forEach((newNode) => {
              node.parentNode?.insertBefore(newNode, node);
            });
          }
          node.parentNode.removeChild(node);
        }
      } catch (err) {
        console.error('Failed to parse HTML:', err);
      }
      editorDiv.remove();
      this.onChange();
      this.render();
    };

    const cancel = () => {
      if (!this.isEditing) return;
      this.isEditing = false;
      editorDiv.remove();
      wrapperEl.style.display = '';
      this.render();
    };

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      commit();
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancel();
    });

    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    textarea.focus();
  }
}