(function() {
    // Initialized outside of the main function to hold state and be accessible by other functions if needed[cite: 1].
    let subjectPrefixGlobal = null;
    let appendCode = () => {
        console.error("appendCode not yet initialized.");
    };
    let updateEditor = () => {
        console.error("updateEditor not yet initialized.");
    };
    let updateCode = () => {
        console.error("updateCode not yet initialized.");
    };

    /**
     * Chrome DevTools-Style DOM Tree Inspector & Editor Component with Drag & Drop
     */
    class DOMTreeInspector {
        constructor(container, options = {}) {
            this.container = container;
            this.doc = options.doc || document;
            this.targetElement = options.targetElement || null;
            this.onChange = options.onChange || (() => {});
            this.isEditing = false;
            this.collapsedNodes = new WeakSet();
            this.voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
            this.draggedNode = null;
            
            this.init();
        }

        init() {
            this.container.classList.add('devtools-dom-tree');
            this.render();
        }

        setTarget(element) {
            this.targetElement = element;
            if (!this.isEditing) {
                this.render();
            }
        }

        render() {
            if (this.isEditing || !this.targetElement) return;
            this.container.innerHTML = '';

            if (!this.targetElement.childNodes || this.targetElement.childNodes.length === 0) {
                const emptyNotice = this.doc.createElement('div');
                emptyNotice.className = 'dom-empty-notice';
                emptyNotice.textContent = '<empty note content>';
                this.container.appendChild(emptyNotice);
                return;
            }

            Array.from(this.targetElement.childNodes).forEach(node => {
                const nodeEl = this.buildNodeTree(node);
                if (nodeEl) this.container.appendChild(nodeEl);
            });
        }

        buildNodeTree(node) {
            if (node.nodeType === 3) { // TEXT_NODE
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
                textSpan.title = "Double-click to edit text | Drag to move";
                
                textSpan.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this.editInline(textSpan, textContent, (newVal) => {
                        node.nodeValue = newVal;
                        this.onChange();
                        this.render();
                    });
                });

                textRow.appendChild(textSpan);
                this.setupDragAndDrop(textRow, node, false);
                return textRow;
            }

            if (node.nodeType === 1) { // ELEMENT_NODE
                const tagName = node.tagName.toLowerCase();
                const isVoid = this.voidTags.has(tagName);
                const hasChildren = node.childNodes.length > 0;
                const isCollapsed = this.collapsedNodes.has(node);

                const elemWrapper = this.doc.createElement('div');
                elemWrapper.className = 'dom-elem-wrapper';

                const tagRow = this.doc.createElement('div');
                tagRow.className = 'dom-row dom-tag-row';
                tagRow.draggable = true;

                // Toggle arrow
                const toggle = this.doc.createElement('span');
                toggle.className = 'dom-arrow' + (hasChildren && !isVoid ? ' has-children' : '');
                toggle.textContent = hasChildren && !isVoid ? (isCollapsed ? '▶' : '▼') : '';
                tagRow.appendChild(toggle);

                // Node line content container
                const lineContent = this.doc.createElement('span');
                lineContent.className = 'dom-line-content';

                // Opening Tag start
                const openTag = this.doc.createElement('span');
                openTag.className = 'dom-tag-start';
                openTag.innerHTML = `&lt;<span class="dom-tag-name">${tagName}</span>`;
                lineContent.appendChild(openTag);

                // Make tag name editable on double click
                const tagNameSpan = openTag.querySelector('.dom-tag-name');
                tagNameSpan.title = "Double-click to change tag name | Drag to move";
                tagNameSpan.addEventListener('dblclick', (e) => {
                    e.stopPropagation();
                    this.editInline(tagNameSpan, tagName, (newTagName) => {
                        const sanitizedTag = newTagName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
                        if (sanitizedTag && sanitizedTag !== tagName) {
                            try {
                                const newElem = this.doc.createElement(sanitizedTag);
                                Array.from(node.attributes).forEach(attr => newElem.setAttribute(attr.name, attr.value));
                                while (node.firstChild) {
                                    newElem.appendChild(node.firstChild);
                                }
                                node.parentNode.replaceChild(newElem, node);
                                this.onChange();
                                this.render();
                            } catch (err) {
                                console.error("Invalid tag name:", err);
                                this.render();
                            }
                        } else {
                            this.render();
                        }
                    });
                });

                // Attributes
                Array.from(node.attributes || []).forEach(attr => {
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
                                    node.removeAttribute(attr.name);
                                }
                                node.setAttribute(match[1], match[2] !== undefined ? match[2] : '');
                            } else if (!newVal.trim()) {
                                node.removeAttribute(attr.name);
                            }
                            this.onChange();
                            this.render();
                        });
                    });

                    lineContent.appendChild(attrSpan);
                });

                // Tag closing bracket
                const tagEnd = this.doc.createElement('span');
                tagEnd.className = 'dom-tag-end';
                tagEnd.textContent = isVoid ? ' />' : '>';
                lineContent.appendChild(tagEnd);

                // Quick Action buttons on hover
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

                // Setup Drag & Drop on the element row
                this.setupDragAndDrop(tagRow, node, !isVoid);

                // Action Event Handlers
                actions.querySelector('[data-action="edit-html"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.editAsHtml(elemWrapper, node);
                });

                actions.querySelector('[data-action="add-attr"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const attrPrompt = prompt('Enter attribute (e.g. style="color: red;" or class="my-class"):');
                    if (attrPrompt) {
                        const match = attrPrompt.trim().match(/^([a-zA-Z0-9_-]+)(?:=(?:"|')?(.*?)(?:"|')?)?$/);
                        if (match && match[1]) {
                            node.setAttribute(match[1], match[2] !== undefined ? match[2] : '');
                            this.onChange();
                            this.render();
                        }
                    }
                });

                actions.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    node.parentNode.removeChild(node);
                    this.onChange();
                    this.render();
                });

                // Children & Closing tag if not void
                if (hasChildren && !isVoid) {
                    const childrenContainer = this.doc.createElement('div');
                    childrenContainer.className = 'dom-children-container';
                    if (isCollapsed) {
                        childrenContainer.style.display = 'none';
                    }

                    Array.from(node.childNodes).forEach(child => {
                        const childTree = this.buildNodeTree(child);
                        if (childTree) childrenContainer.appendChild(childTree);
                    });

                    elemWrapper.appendChild(childrenContainer);

                    // Closing tag row
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

                    // Expand / Collapse action
                    toggle.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const collapsed = childrenContainer.style.display === 'none';
                        if (collapsed) {
                            childrenContainer.style.display = 'block';
                            closeTagRow.style.display = 'block';
                            toggle.textContent = '▼';
                            this.collapsedNodes.delete(node);
                            const placeholder = tagRow.querySelector('.dom-collapsed-placeholder');
                            if (placeholder) placeholder.remove();
                        } else {
                            childrenContainer.style.display = 'none';
                            closeTagRow.style.display = 'none';
                            toggle.textContent = '▶';
                            this.collapsedNodes.add(node);
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

        setupDragAndDrop(rowEl, node, canHaveChildren) {
            rowEl.addEventListener('dragstart', (e) => {
                if (this.isEditing || e.target.closest('.dom-action-btn, input, textarea, .dom-arrow')) {
                    e.preventDefault();
                    return;
                }
                this.draggedNode = node;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
                rowEl.classList.add('dom-dragging');
                e.stopPropagation();
            });

            rowEl.addEventListener('dragend', () => {
                this.draggedNode = null;
                this.doc.querySelectorAll('.dom-row').forEach(el => {
                    el.classList.remove('dom-dragging', 'dom-drop-before', 'dom-drop-after', 'dom-drop-inside');
                });
            });

            rowEl.addEventListener('dragover', (e) => {
                if (!this.draggedNode || this.draggedNode === node) return;
                // Prevent dropping a parent inside one of its own descendants
                if (this.draggedNode.nodeType === 1 && this.draggedNode.contains(node)) return;

                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';

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

            rowEl.addEventListener('drop', (e) => {
                if (!this.draggedNode || this.draggedNode === node) return;
                if (this.draggedNode.nodeType === 1 && this.draggedNode.contains(node)) return;

                e.preventDefault();
                e.stopPropagation();

                const isBefore = rowEl.classList.contains('dom-drop-before');
                const isAfter = rowEl.classList.contains('dom-drop-after');
                const isInside = rowEl.classList.contains('dom-drop-inside');

                rowEl.classList.remove('dom-drop-before', 'dom-drop-after', 'dom-drop-inside');

                if (isInside && node.nodeType === 1) {
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

        editInline(containerEl, initialValue, onCommit) {
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

        editAsHtml(wrapperEl, node) {
            this.isEditing = true;
            const currentHtml = node.nodeType === 1 ? node.outerHTML : node.nodeValue;
            
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
            parent.insertBefore(editorDiv, wrapperEl);
            wrapperEl.style.display = 'none';

            const commit = () => {
                if (!this.isEditing) return;
                this.isEditing = false;
                const newHtml = textarea.value;
                try {
                    const tempDiv = this.doc.createElement('div');
                    tempDiv.innerHTML = newHtml;
                    const newNodes = Array.from(tempDiv.childNodes);
                    if (newNodes.length > 0) {
                        newNodes.forEach(newNode => {
                            node.parentNode.insertBefore(newNode, node);
                        });
                        node.parentNode.removeChild(node);
                    } else {
                        node.parentNode.removeChild(node);
                    }
                } catch (err) {
                    console.error("Failed to parse HTML:", err);
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

    /**
     * Parses a string for repeat sections and variables[cite: 1].
     */
    function parseTemplateContent(templateString) {
        const variables = [];
        const sections = [];
        let variableMatch;
        const repeatRegex = /\{\{(repeat):([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/;
        let repeatMatch,
            remainingString = templateString;

        for (; repeatMatch = repeatRegex.exec(remainingString);) {
            const section = {
                type: repeatMatch[1],
                label: repeatMatch[2],
                content: repeatMatch[3],
                variables: []
            };

            let variableMatchInside;
            let sectionContent = section.content;
            const variableRegexInside = /\[([^\]]+)\]/g;
            for (; variableMatchInside = variableRegexInside.exec(sectionContent);) {
                section.variables.push(variableMatchInside[1]);
            }

            sections.push(section);
            remainingString = remainingString.replace(repeatMatch[0], `{{section:${section.label}}}`);
            repeatRegex.lastIndex = 0;
        }

        const variableRegex = /\[([^\]]+)\]/g;
        for (; variableMatch = variableRegex.exec(remainingString);) {
            variables.push(variableMatch[1]);
        }

        return {
            variables: variables.filter((variable, index, array) => array.indexOf(variable) === index),
            sections: sections,
            templateString: remainingString
        };
    }

    /**
     * Creates and displays the template filling dialog[cite: 1].
     */
    function showTemplateDialog(parsedTemplateBlocks, templateConfig) {
        const dialog = document.createElement("dialog");
        dialog.style.cssText = `
            /* Legacy Window Style */
            border: 1px solid #7F9DB9;
            border-radius: 0;
            padding: 0;
            box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.4);
            max-width: 600px;
            width: 90%;
            background-color: #ECECEC;
            font-family: Tahoma, Verdana, Segoe, sans-serif;
            font-size: 11px;
        `;
        dialog.innerHTML = `
            <div style="
                padding: 12px;
                position: relative;
                background-color: #EBEBEB;
                border-bottom: 1px solid #C0C0C0;
            ">
                <button class="close-button" style="
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    font-size: 16px;
                    cursor: pointer;
                    background: none;
                    border: 1px outset #C0C0C0;
                    width: 20px;
                    height: 20px;
                    line-height: 1;
                    padding: 0;
                    color: #333;
                ">&times;</button>
                <h2 style="font-size: 12px; font-weight: bold; margin: 0; padding-right: 25px;">Fill Template Variables</h2>
            </div>
        `;

        var templateBlockGenerators = [];

        parsedTemplateBlocks.forEach(({
            content: templateBlockContent,
            type: templateBlockType,
            label: templateBlockLabel
        }) => {
            const form = document.createElement("form");
            form.style.cssText = `
                padding: 12px;
                border: 1px solid #C0C0C0;
                border-radius: 0;
                margin: 12px;
                background-color: #F0F0F0;
            `;

            if (templateBlockType === "optional") {
                const optionalToggleDiv = document.createElement("div");
                optionalToggleDiv.style.marginBottom = "8px";
                const checkbox = optionalToggleDiv.appendChild(document.createElement("input"));
                checkbox.type = "checkbox";
                checkbox.id = `toggle-${templateBlockLabel}`;
                checkbox.checked = true;

                const label = optionalToggleDiv.appendChild(document.createElement("label"));
                label.textContent = `Include optional section: ${templateBlockLabel}`;
                label.htmlFor = `toggle-${templateBlockLabel}`;
                label.style.cssText = "font-weight: bold; font-size: 11px; margin-left: 5px; color: #333;";

                form.appendChild(optionalToggleDiv);

                checkbox.addEventListener("change", () => {
                    form.querySelectorAll('textarea, button').forEach(el => {
                        el.disabled = !checkbox.checked;
                    });
                });
            }

            templateBlockContent.variables.forEach(variableName => {
                let div = document.createElement("div");
                div.style.marginBottom = "8px";

                let label = div.appendChild(document.createElement("label"));
                label.textContent = variableName;
                label.style.cssText = "display: block; font-weight: bold; font-size: 11px; margin-bottom: 3px; color: #333;";

                let textarea = div.appendChild(document.createElement("textarea"));
                textarea.name = variableName;
                textarea.style.cssText = `
                    width: 100%;
                    padding: 3px;
                    border: 1px solid #7F9DB9;
                    border-radius: 0;
                    box-sizing: border-box;
                    font-size: 11px;
                `;
                form.appendChild(div);
            });

            templateBlockContent.sections.forEach(section => {
                const sectionDiv = document.createElement("div");
                sectionDiv.style.cssText = "border-top: 1px solid #C0C0C0; padding-top: 12px; margin-top: 12px;";

                if (section.type === "repeat") {
                    sectionDiv.innerHTML = `<h3 style="font-weight: bold; font-size: 12px; margin-bottom: 8px;">${section.label} (Repeating)</h3>`;

                    const addButton = document.createElement("span"); 
                    addButton.textContent = "Add Item";
                    addButton.setAttribute("role", "button");
                    addButton.style.cssText = `
                        display: inline-block;
                        background-color: #E0E0E0;
                        color: #000;
                        padding: 2px 8px;
                        border: 1px outset #C0C0C0;
                        border-radius: 0;
                        font-size: 11px;
                        margin-top: 6px;
                        cursor: pointer;
                        user-select: none;
                    `;

                    const repeatItemsContainer = document.createElement("div");
                    repeatItemsContainer.style.cssText = "border: 1px solid #C0C0C0; padding: 6px; border-radius: 0; background-color: white; margin-top: 6px; display: flex; flex-direction: column; gap: 8px;";

                    sectionDiv.appendChild(repeatItemsContainer);
                    sectionDiv.appendChild(addButton);
                    form.appendChild(sectionDiv);

                    addButton.addEventListener("click", ((event) => {
                        event.stopPropagation();
                        event.preventDefault();

                        const itemDiv = document.createElement("div");
                        itemDiv.style.cssText = "padding: 6px; border: 1px solid #D0D0D0; background-color: #F8F8F8;";

                        section.variables.forEach(variableName => {
                            const label = document.createElement("label");
                            label.textContent = variableName;
                            label.style.cssText = "display: block; font-size: 11px; margin-bottom: 3px; margin-top: 6px;";

                            const textarea = document.createElement("textarea");
                            textarea.name = `${section.type}[${repeatItemsContainer.children.length}][${variableName}]`;
                            textarea.style.cssText = "width: 100%; padding: 3px; border: 1px solid #7F9DB9; box-sizing: border-box; font-size: 11px;";

                            itemDiv.appendChild(label);
                            itemDiv.appendChild(textarea);
                        });
                        repeatItemsContainer.appendChild(itemDiv);
                    }));
                }
            });

            templateBlockGenerators.push((() => {
                const formData = new FormData(form);

                function generateOutput(type, templateData, data) {
                    let output = "";

                    function fillTemplate() {
                        let resultString = templateData.templateString;

                        templateData.variables.forEach(variableName => {
                            const value = data.get(variableName) || "";
                            resultString = resultString.replace(new RegExp(`\\[${variableName}\\]`, "g"), value.replaceAll(/\r\n?|\n/g, "<br>"));
                        });

                        templateData.sections.forEach(section => {
                            let sectionOutput = "";
                            if (section.type === "repeat") {
                                let itemIndex = 0;
                                const firstVariable = section.variables[0];

                                for (; data.has(`${section.type}[${itemIndex}][${firstVariable}]`);) {
                                    let itemString = section.content;

                                    section.variables.forEach(variableName => {
                                        const itemValue = data.get(`${section.type}[${itemIndex}][${variableName}]`) || "";
                                        itemString = itemString.replace(new RegExp(`\\[${variableName}\\]`, "g"), itemValue.replaceAll(/\r\n?|\n/g, "<br>"));
                                    });

                                    sectionOutput += itemString;
                                    itemIndex++;
                                }
                            }
                            resultString = resultString.replace(new RegExp(`{{section:${section.label}}}`, "g"), sectionOutput);
                        });

                        return resultString;
                    }

                    if (type === "default") {
                        output = fillTemplate();
                    } else if (type === "optional") {
                        const isChecked = form.querySelector(`#toggle-${templateBlockLabel}`).checked;
                        const hasStandardVars = templateData.variables.some(variableName => (data.get(variableName) || "").trim() !== "");
                        const hasRepeatVars = templateData.sections.some(section =>
                            section.type === "repeat" && data.has(`repeat[0][${section.variables[0]}]`)
                        );

                        if (isChecked && (hasStandardVars || hasRepeatVars)) {
                            output = fillTemplate();
                        }
                    }

                    return output;
                }

                return generateOutput(templateBlockType, templateBlockContent, formData);
            }));

            dialog.querySelector("div:first-child").appendChild(form);
        });

        const insertButton = document.createElement("span"); 
        insertButton.setAttribute("role", "button");
        insertButton.style.cssText = `
            display: inline-block;
            background-color: #E0E0E0;
            color: #000;
            padding: 4px 12px;
            border: 1px outset #C0C0C0;
            border-radius: 0;
            margin: 12px;
            font-size: 11px;
            cursor: pointer;
            font-weight: bold;
            user-select: none;
        `;
        insertButton.textContent = "Insert Template";

        dialog.querySelector("div:first-child").appendChild(insertButton);
        document.body.appendChild(dialog);
        dialog.showModal();

        dialog.querySelector(".close-button").addEventListener("click", (() => {
            dialog.close();
            dialog.remove();
        }));

        insertButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            var finalOutput = templateBlockGenerators.reduce((accumulator, generator) => accumulator + generator(), "");

            if (templateConfig && templateConfig.subjectPrefix !== undefined) {
                subjectPrefixGlobal = templateConfig.subjectPrefix;
            }

            appendCode(finalOutput);
            dialog.close();
            dialog.remove();

            const templateSelector = document.getElementById("template-selector");
            if (templateSelector) {
                templateSelector.value = "";
            }
        });
    }

    // --- Template Definitions ---
    var templates = {
        "action-item": {
            text: "Action Item",
            subjectPrefix: null,
            code: "<b>Action item(s)</b><br><ul>{{repeat:Action Items}}<li>[Action item]</li>{{/repeat}}</ul>{{optional:a}}<b>Next steps</b><br><ul>{{repeat:Next Steps}}<li>[Next step]</li>{{/repeat}}</ul>{{/optional}}"
        },
        "quote-block": {
            text: "Quote Block",
            subjectPrefix: null,
            code: '{{optional:a}}[Pre Quote]:<br><br>{{/optional}}<i style="color: gray; font-style: italic;">[quote]</i><br>{{optional:b}}<br>[Post Quote]<br>{{/optional}}'
        },
        "qa-response": {
            text: "QA Response",
            subjectPrefix: null,
            code: '{{repeat:Note}}<i style="color: gray;">[QA Note]</i><br><br>{Response}<br><br>{{/repeat}}'
        },
        "communication-template": {
            text: "Communication",
            subjectPrefix: null,
            code: "<i>[description]</i><br>{{optional:b}}<br><b>Topics discussed</b><ul>{{repeat:Topics Discussed}}<li>[Topic]</li>{{/repeat}}</ul>{{/optional}}{{optional:a}}<b>Follow up needed</b><br><ul>{{repeat:Follow ups needed}}<li>[Follow up]</li>{{/repeat}}</ul>{{/optional}}"
        },
        "email-template": {
            text: "Email",
            subjectPrefix: null,
            code: "<table><tbody><tr><td><b>from:</b></td><td>[from]</td></tr><tr><td><b>to:</b></td><td>[to]</td></tr>{{optional:b}}<tr><td><b>cc:</b></td><td>[cc]</td></tr>{{/optional}}{{optional:c}}<tr><td><b>sent:</b></td><td>[sent]</td></tr>{{/optional}}{{optional:a}}<tr><td><b>subject:</b></td><td>[subject]</td></tr>{{/optional}}</tbody></table><br>[body]"
        },
        "estimate-update": {
            text: "Estimate Updated",
            subjectPrefix: "Estimate Updated",
            code: "<ul><li><b>Estimate amount updated to [New Estimate Amount]</b></li>{{optional:Notes}}{{repeat:Notes}}<li>[Note]</li>{{/repeat}}{{/optional}}</ul>"
        },
        "initial-report": {
            text: "Initial Report",
            subjectPrefix: "Initial Report",
            code: "<i>[Narrative]</i><br><br>{{optional:a}}<b>Initial Observations</b><br><ul>{{repeat:Observations}}<li>[observation]</li>{{/repeat}}</ul>{{/optional}}{{optional:b}}<b>Initial Scope</b><br><ul>{{repeat:Scope Items}}<li>[scope item]</li>{{/repeat}}</ul>{{/optional}}"
        },
        "status-update": {
            text: "Status Update",
            subjectPrefix: "Project Status",
            code: "<b>Weekly Project Update [Date]</b><br>{{optional:b}}<br><b>This Week’s Activities:</b><br><ul>{{repeat:This week's activities}}<li>[This Week's Activity]</li>{{/repeat}}</ul>{{/optional}}{{optional:c}}<br><b>Activities for Next Week:</b><ul>{{repeat:Next week's activities}}<li>[Next Week's Activity]</li>{{/repeat}}</ul>{{/optional}}{{optional:a}}<br><b>Issues/Risks:</b><ul>{{repeat:Issues/Risks}}<li>[Issue]</li>{{/repeat}}</ul>{{/optional}}"
        },
        "site-visit": {
            text: "Site Visit",
            subjectPrefix: "Site Visit",
            code: "<b>Site Visit Report</b><br><b>Purpose:</b> [Purpose of Visit]{{optional:a}}<br><br><b>Observations:</b><br><ul>{{repeat:Observations}}<li>[Observation Detail]</li>{{/repeat}}</ul>{{/optional}}"
        },
        "invoice-update": {
            text: "Invoice Updated",
            subjectPrefix: "Invoice Updated",
            code: "Updated invoice to reconcile with estimate. Emailed to: [Email recipients]."
        },
        "check-received": {
            text: "Check Received",
            subjectPrefix: "Check received",
            code: "Received check [Check number]. [Other notes]"
        }
    };

    /**
     * Attempts to find and manipulate the host application's iframe/modal container[cite: 1].
     */
    const setupHostEnvironment = function() {
        const wrapper = document.getElementById("RadWindowWrapper_ctl00_ContentPlaceHolder1_RadWindow_Common");
        if (!wrapper) {
            console.error("Top-level wrapper #RadWindowWrapper... not found. Ensure the modal is open.");
            return null;
        }

        wrapper.style.removeProperty("position");
        wrapper.style.removeProperty("width");
        wrapper.style.removeProperty("height");
        wrapper.style.position = "fixed";
        wrapper.style.top = "2em";
        wrapper.style.bottom = "2em";
        wrapper.style.right = "2em";
        wrapper.style.left = "2em";
        wrapper.style.maxWidth = "calc(100vw - 4em)";
        wrapper.style.boxSizing = "border-box";

        const table = wrapper.querySelector("table.rwTable");
        if (table) {
            table.style.removeProperty("height");
        }

        const iframe = wrapper.querySelector("iframe");
        if (!iframe || !iframe.contentDocument) {
            console.error("IFrame or IFrame content not accessible.");
            return null;
        }

        const iframeDoc = iframe.contentDocument;
        const iframeWin = iframe.contentWindow;

        const style = iframeDoc.createElement("style");
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
    }();

    if (setupHostEnvironment) {
        const {
            doc: iframeDoc,
            win: iframeWin
        } = setupHostEnvironment;
        const originalTextareaSelector = 'textarea[name="AddNotesUserControl$body"]';
        const originalTextarea = iframeDoc.querySelector(originalTextareaSelector);

        if (originalTextarea) {
            (function setupEditor(originalTextarea, doc, win) {
                originalTextarea.id = "TemplateSource";

                let domInspector = null;
                const sanitizedRoot = doc.createElement("div");

                const toast = doc.createElement("div");
                toast.id = "char-limit-warning";
                toast.textContent = "WARNING: The note is too long and may be truncated, causing data loss. Please shorten the content.";
                doc.body.appendChild(toast);

                const subjectInput = doc.querySelector('input[name="AddNotesUserControl$SubjectLine"]');
                const visibilityInput = doc.querySelector('input[name="AddNotesUserControl$VisibilityControl$radCombo_ObjectOwnershipType"]');

                function isPreviousSiblingBlock(element) {
                    const sibling = element.previousSibling;
                    if (!sibling) return true;
                    if (sibling.nodeType !== 1) return false;

                    const display = win.getComputedStyle(sibling).display;
                    return display === "block" || display === "flex" || display === "grid" || sibling.nodeName === "BR";
                }

                function cleanHtml(nodes) {
                    let htmlString = nodes.map(node => {
                        var text = "";
                        if (node.nodeType === 1) {
                            if (node.nodeName === "DIV" || node.nodeName === "P" || node.nodeName.match(/^H[1-6]$/)) {
                                if (!isPreviousSiblingBlock(node)) {
                                    text += "<br>";
                                }
                                text += cleanHtml([...node.childNodes]);
                                if (!text.endsWith("<br>")) {
                                    text += "<br>";
                                }
                            } else if (node.nodeName === "TABLE" || node.nodeName === "UL" || node.nodeName === "OL") {
                                if (!isPreviousSiblingBlock(node)) {
                                    text += "<br>";
                                }
                                text += node.outerHTML;
                                if (!text.endsWith("<br>")) {
                                    text += "<br>";
                                }
                            } else {
                                text += node.outerHTML;
                            }
                        } else {
                            text = node.textContent;
                        }
                        return text;
                    }).join("");

                    for (; htmlString.indexOf("<br><br><br>") !== -1;) {
                        htmlString = htmlString.replace("<br><br><br>", "<br><br>");
                    }
                    return htmlString;
                }

                // Helper to update the character counter's text and color[cite: 1]
                function updateCharCounter(textarea, counterElement, limit) {
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

                const updateEditorFromSource = function() {
                    const sourceTextarea = doc.getElementById("TemplateSource");
                    const editableContent = doc.getElementById("editable-content");
                    const counter = doc.getElementById("char-counter");

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

                const updateSourceFromEditor = function(fromInspector = false) {
                    const sourceTextarea = doc.getElementById("TemplateSource");
                    const editableContent = doc.getElementById("editable-content");
                    const counter = doc.getElementById("char-counter");
                    const toast = doc.getElementById("char-limit-warning"); 
    
                    const submitButton1 = doc.getElementById("AddNotesUserControl_AddButton2");
                    const submitButton2 = doc.getElementById("AddNotesUserControl_AddButton");
    
                    // --- Determine the Limit based on Visibility ---
                    const visibilityInput = doc.querySelector('input[name="AddNotesUserControl$VisibilityControl$radCombo_ObjectOwnershipType"]');
                    const isPublic = visibilityInput && visibilityInput.value === "Public";
                    
                    const LIMIT = isPublic ? 3700 : Infinity;
                    
                    if (fromInspector) {
                        const newHtml = sanitizedRoot.innerHTML;
                        if (sourceTextarea && sourceTextarea.value !== newHtml) {
                            sourceTextarea.value = newHtml;
                        }
                        if (editableContent && editableContent.innerHTML !== newHtml) {
                            editableContent.innerHTML = newHtml;
                        }

                        const currentLength = newHtml.length;
                        const isOverLimit = currentLength > LIMIT;
                        if (isOverLimit) {
                            if (toast) toast.style.display = 'block';
                            if (submitButton1) submitButton1.disabled = true;
                            if (submitButton2) submitButton2.disabled = true;
                        } else {
                            if (toast) toast.style.display = 'none';
                            if (submitButton1) submitButton1.disabled = false;
                            if (submitButton2) submitButton2.disabled = false;
                        }
                        if (sourceTextarea && counter) {
                            updateCharCounter(sourceTextarea, counter, LIMIT);
                        }
                        return;
                    }

                    if (sourceTextarea && editableContent) {
                        var cleanedHtml = cleanHtml([...editableContent.childNodes]);
                        const currentLength = cleanedHtml.length;

                        const isOverLimit = currentLength > LIMIT;
                        
                        if (isOverLimit) {
                            if (toast) toast.style.display = 'block';
                            if (submitButton1) submitButton1.disabled = true;
                            if (submitButton2) submitButton2.disabled = true;
                        } else {
                            if (toast) toast.style.display = 'none';
                            if (submitButton1) submitButton1.disabled = false;
                            if (submitButton2) submitButton2.disabled = false;
                        }
                        
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
                
                updateEditor = updateEditorFromSource;
                updateCode = updateSourceFromEditor;

                appendCode = function(code) {
                    const sourceTextarea = doc.getElementById("TemplateSource");
                    if (sourceTextarea) {
                        sourceTextarea.value += (sourceTextarea.value.length !== 0 ? "<br>" : "") + code;
                        updateEditorFromSource();

                        if (subjectPrefixGlobal && subjectInput) {
                            const currentSubject = subjectInput.value;
                            const subjectLinePrefix = "Email from PCC Cleaning & Restoration for:";
                            if (currentSubject.startsWith(subjectLinePrefix)) {
                                const originalName = currentSubject.substring(subjectLinePrefix.length).trim();
                                subjectInput.value = `${subjectPrefixGlobal} for: ${originalName}`;
                            }
                            subjectPrefixGlobal = null;
                        }
                    }
                };

                const originalRow = originalTextarea.closest("tr");
                const originalCell = originalTextarea.closest("td");

                if (!originalRow || !originalCell) {
                    return console.error("Original textarea is not contained in a standard table row/cell.");
                }

                // --- NEW CSS: DevTools-style DOM Tree, Equal Width, Wrapping and Counter Styling ---
                const customStyle = doc.createElement("style");
                customStyle.textContent = `
                    /* Container for the Split View */
                    .editor-split-container {
                        display: flex;
                        height: 400px;
                        gap: 16px;
                        width: 100%;
                        max-width: 100%;
                        box-sizing: border-box;
                    }
                    #editable-wrapper, #source-wrapper {
                        display: flex;
                        flex-direction: column;
                        flex: 1 1 50%;
                        width: 50%;
                        max-width: 50%;
                        min-width: 0;
                        min-height: 0;
                        height: 100%;
                        box-sizing: border-box;
                        overflow: hidden;
                    }
                    /* Inspector Header and Tabs */
                    .inspector-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 4px;
                        flex-shrink: 0;
                    }
                    .inspector-tabs {
                        display: flex;
                        gap: 2px;
                    }
                    .inspector-tab-btn {
                        background-color: #E0E0E0;
                        border: 1px outset #C0C0C0;
                        cursor: pointer;
                        padding: 1px 6px;
                        font-size: 10px;
                        font-weight: bold;
                        color: #333;
                        user-select: none;
                    }
                    .inspector-tab-btn.active {
                        background-color: #FFFFFF;
                        border-bottom: 1px solid #FFFFFF;
                        color: #000;
                    }
                    #source-elements {
                        display: flex;
                        flex-direction: column;
                        flex: 1 1 0;
                        height: 100%;
                        width: 100%;
                        min-height: 0;
                        min-width: 0;
                        position: relative;
                        overflow: hidden;
                        box-sizing: border-box;
                    }
                    /* Styling for original textarea (Raw HTML view with word wrap) */
                    #TemplateSource {
                        flex: 1 1 0;
                        height: 100%;
                        min-height: 0;
                        font-family: Consolas, Monaco, monospace;
                        font-size: 11px;
                        resize: none;
                        padding: 4px;
                        border: 1px inset #C0C0C0;
                        background-color: white;
                        box-sizing: border-box;
                        width: 100%;
                        max-width: 100%;
                        overflow-y: auto !important;
                        overflow-x: hidden !important;
                        white-space: pre-wrap !important;
                        word-break: break-word !important;
                        overflow-wrap: break-word !important;
                    }
                    /* Custom Editor Styles */
                    #editor-container {
                        display: flex;
                        flex-direction: column;
                        flex: 1 1 0;
                        height: 100%;
                        min-height: 0;
                        width: 100%;
                        max-width: 100%;
                        border: 1px inset #C0C0C0;
                        border-radius: 0;
                        background-color: white;
                        box-sizing: border-box;
                        overflow: hidden;
                    }
                    #custom-toolbar {
                        flex-shrink: 0;
                        border-bottom: 1px solid #C0C0C0;
                        padding: 2px;
                        background-color: #EBEBEB;
                        border-radius: 0;
                    }
                    #custom-toolbar .custom-cmd-btn {
                        background-color: #EBEBEB;
                        border: 1px outset #C0C0C0;
                        cursor: pointer;
                        padding: 2px 6px;
                        font-weight: bold;
                        font-size: 11px;
                        line-height: 1.2;
                        margin: 0 1px;
                        border-radius: 0;
                        color: #000;
                        display: inline-block;
                        user-select: none;
                    }
                    #custom-toolbar .custom-cmd-btn:active {
                        border: 1px inset #C0C0C0;
                        background-color: #D0D0D0;
                    }
                    #editable-content {
                        flex: 1 1 0;
                        min-height: 0;
                        overflow-y: auto !important;
                        overflow-x: hidden;
                        padding: 4px;
                        outline: none;
                        font-family: Tahoma, Verdana, Segoe, sans-serif;
                        font-size: 11px;
                        word-break: break-word;
                        overflow-wrap: break-word;
                        white-space: pre-wrap;
                        box-sizing: border-box;
                    }

                    /* --- Chrome DevTools DOM Tree Inspector Styles --- */
                    .devtools-dom-tree {
                        flex: 1 1 0;
                        width: 100%;
                        height: 100%;
                        min-height: 0;
                        min-width: 0;
                        overflow-y: auto !important;
                        overflow-x: auto !important;
                        padding: 4px;
                        border: 1px inset #C0C0C0;
                        background-color: #FFFFFF;
                        font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
                        font-size: 11px;
                        line-height: 1.45;
                        color: #222222;
                        box-sizing: border-box;
                        display: block;
                    }
                    .dom-empty-notice {
                        color: #888888;
                        font-style: italic;
                        padding: 8px;
                    }
                    .dom-elem-wrapper {
                        display: block;
                    }
                    .dom-row {
                        display: flex;
                        align-items: flex-start;
                        min-height: 18px;
                        border-radius: 2px;
                        padding: 0 2px;
                        cursor: grab;
                        position: relative;
                        box-sizing: border-box;
                        width: fit-content;
                        min-width: 100%;
                        white-space: nowrap;
                    }
                    /* Text Node Word Wrap */
                    .dom-row.dom-text-node {
                        white-space: normal !important;
                        word-break: break-word !important;
                        overflow-wrap: anywhere !important;
                        width: 100%;
                        min-width: 0;
                    }
                    .dom-text-content {
                        color: #222222;
                        cursor: text;
                        white-space: normal !important;
                        word-break: break-word !important;
                        overflow-wrap: anywhere !important;
                        flex: 1 1 auto;
                        min-width: 0;
                    }
                    .dom-row:hover {
                        background-color: #EBF3FD;
                    }
                    .dom-row.dom-dragging {
                        opacity: 0.35;
                        background-color: #ECECEC !important;
                    }
                    .dom-row.dom-drop-before {
                        border-top: 2px solid #1a73e8 !important;
                    }
                    .dom-row.dom-drop-after {
                        border-bottom: 2px solid #1a73e8 !important;
                    }
                    .dom-row.dom-drop-inside {
                        background-color: #E8F0FE !important;
                        outline: 1px dashed #1a73e8;
                    }
                    .dom-arrow {
                        display: inline-block;
                        width: 12px;
                        font-size: 8px;
                        color: #727272;
                        cursor: pointer;
                        text-align: center;
                        user-select: none;
                        flex-shrink: 0;
                        margin-top: 2px;
                    }
                    .dom-arrow.has-children:hover {
                        color: #000;
                    }
                    .dom-arrow-spacer {
                        display: inline-block;
                        width: 12px;
                        flex-shrink: 0;
                    }
                    .dom-line-content {
                        display: inline-flex;
                        align-items: center;
                        flex-grow: 1;
                        white-space: nowrap;
                    }
                    .dom-tag-start, .dom-tag-close, .dom-tag-end {
                        color: #888888;
                    }
                    .dom-tag-name {
                        color: #881280; /* DevTools Tag Color */
                        font-weight: bold;
                        cursor: text;
                    }
                    .dom-attr-pair {
                        cursor: text;
                        margin-left: 2px;
                    }
                    .dom-attr-name {
                        color: #994500; /* DevTools Attribute Key */
                    }
                    .dom-attr-val {
                        color: #1a1aa6; /* DevTools Attribute Value */
                    }
                    .dom-collapsed-placeholder {
                        color: #888888;
                        margin-left: 2px;
                    }
                    .dom-children-container {
                        padding-left: 12px;
                        border-left: 1px dotted #D0D0D0;
                        margin-left: 5px;
                    }
                    .dom-node-actions {
                        display: none;
                        margin-left: 8px;
                        gap: 3px;
                    }
                    .dom-row:hover .dom-node-actions {
                        display: inline-flex;
                    }
                    .dom-action-btn {
                        font-size: 9px;
                        padding: 0 3px;
                        background: #E8E8E8;
                        border: 1px solid #B0B0B0;
                        border-radius: 2px;
                        cursor: pointer;
                        color: #333333;
                        line-height: 1.2;
                        user-select: none;
                    }
                    .dom-action-btn:hover {
                        background: #D0D0D0;
                        color: #000;
                    }
                    .dom-inline-input {
                        font-family: inherit;
                        font-size: inherit;
                        border: 1px solid #1a73e8;
                        outline: none;
                        background: #ffffff;
                        padding: 0 2px;
                        margin: 0;
                        color: inherit;
                        min-height: 16px;
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .dom-html-editor-container {
                        padding: 4px;
                        margin: 4px 0;
                        background: #F8F8F8;
                        border: 1px solid #7F9DB9;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }
                    .dom-html-editor-textarea {
                        font-family: Consolas, Monaco, monospace;
                        font-size: 11px;
                        width: 100%;
                        height: 90px;
                        border: 1px solid #C0C0C0;
                        box-sizing: border-box;
                        padding: 4px;
                    }
                    .dom-html-editor-buttons {
                        display: flex;
                        gap: 6px;
                    }
                    .dom-btn {
                        display: inline-block;
                        padding: 2px 8px;
                        border: 1px outset #C0C0C0;
                        font-size: 10px;
                        cursor: pointer;
                        user-select: none;
                        background-color: #E0E0E0;
                        color: #000;
                    }
                    .dom-btn-save {
                        font-weight: bold;
                        background-color: #D4EDDA;
                        border-color: #C3E6CB;
                    }

                    td {
                        height: 1px;
                    }

                    #template-controls {
                        display: flex;
                        align-items: center;
                        margin-bottom: 8px;
                        padding: 4px;
                        background-color: #F0F0F0;
                        border: 1px solid #C0C0C0;
                        border-radius: 0;
                        box-shadow: 1px 1px 1px rgba(0,0,0,0.05);
                        flex-shrink: 0;
                    }
                    #template-controls label {
                        font-size: 11px;
                        font-weight: bold;
                        color: #333;
                        margin-right: 10px;
                    }
                    #template-selector {
                        padding: 2px 20px 2px 2px;
                        border: 1px solid #7F9DB9;
                        border-radius: 0;
                        width: 256px;
                        font-size: 11px;
                        height: 20px;
                        background-image: url(https://dash-ngs.net/NextGear/Enterprise/WebResource.axd?d=lyo2MHskRin2WHuMO8Fg1g4cW3rXIujb0Nz7O_2So15AnA1Lxn-A5vT3M_oyccIReHDaaj-ysIaLRhHAs5NvsdE1nDOfgVy9UW2gmpQ1kVNMg_AItPJhrS3zgOf0SaJkRsR-RPtSjVTT4G_agMZebt_IlFI1&t=638943446488620555);
                        background-repeat: no-repeat;
                        background-position: 0 -88px;
                    }
                    #char-counter {
                        font-size: 10px;
                        margin-top: 4px;
                        text-align: right;
                        flex-shrink: 0;
                    }
                    #char-limit-warning {
                        position: fixed;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        padding: 8px 15px;
                        background-color: #A00000;
                        color: white;
                        font-weight: bold;
                        border: 2px solid #FFCCCC;
                        border-radius: 4px;
                        z-index: 10000;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                        display: none;
                        font-size: 14px;
                        text-align: center;
                    }                    
                `;
                doc.head.appendChild(customStyle);

                // --- DOM & Visual Editor Split Layout ---
                const newRow = doc.createElement("tr");
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

                originalRow.parentNode.replaceChild(newRow, originalRow);

                // Attach original textarea (used for form submission and Raw HTML view)
                const sourceElementsDiv = newRow.querySelector("#source-elements");
                const charCounterElement = newRow.querySelector("#char-counter");
                const domContainer = newRow.querySelector("#dom-inspector-container");
                sourceElementsDiv.appendChild(originalTextarea);
                originalTextarea.style.display = "none";

                const editableContentDiv = doc.getElementById("editable-content");

                // Initialize the DevTools DOM Tree Inspector bound to sanitizedRoot
                domInspector = new DOMTreeInspector(domContainer, {
                    doc: doc,
                    targetElement: sanitizedRoot,
                    onChange: () => {
                        updateSourceFromEditor(true);
                    }
                });

                // Tab switching between DOM Tree and Raw HTML
                const tabDomTree = newRow.querySelector("#tab-dom-tree");
                const tabRawHtml = newRow.querySelector("#tab-raw-html");

                tabDomTree.addEventListener("click", () => {
                    tabDomTree.classList.add("active");
                    tabRawHtml.classList.remove("active");
                    domContainer.style.display = "block";
                    originalTextarea.style.display = "none";
                    updateEditorFromSource();
                });

                tabRawHtml.addEventListener("click", () => {
                    tabRawHtml.classList.add("active");
                    tabDomTree.classList.remove("active");
                    domContainer.style.display = "none";
                    originalTextarea.style.display = "block";
                    updateSourceFromEditor();
                });

                const toolbar = doc.getElementById("custom-toolbar");
                Array.from(toolbar.querySelectorAll(".custom-cmd-btn")).forEach((span) => { 
                    const command = span.getAttribute("data-cmd");
                    if (command) {
                        span.addEventListener("click", ((event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            updateEditorFromSource(); 

                            doc.execCommand(command, false, null);
                            doc.getElementById("editable-content").focus();
                            updateSourceFromEditor();
                        }));
                    }
                });

                updateEditorFromSource(); // Initial sync

                if (visibilityInput) {
                    visibilityInput.addEventListener("change", () => updateSourceFromEditor());
                    updateSourceFromEditor();
                }

                // Add event listeners for synchronization and character counting
                editableContentDiv.addEventListener("input", () => updateSourceFromEditor());
                originalTextarea.addEventListener("input", () => updateEditorFromSource());

                // Initial character count display
                updateCharCounter(originalTextarea, charCounterElement);

                const templateSelector = newRow.querySelector("#template-selector");

                const defaultOption = doc.createElement("option");
                defaultOption.value = "";
                defaultOption.textContent = "Select template";
                defaultOption.selected = true;
                defaultOption.disabled = true;
                templateSelector.appendChild(defaultOption);

                Object.keys(templates).forEach(function(key) {
                    const template = templates[key];
                    const option = doc.createElement("option");
                    option.value = key;
                    option.textContent = template.text;
                    templateSelector.appendChild(option);
                });

                templateSelector.addEventListener("change", (() => {
                    const selectedKey = templateSelector.value;
                    if (selectedKey) {
                        const templateData = templates[selectedKey];
                        const parsedBlocks = parseTemplateIntoBlocks(templateData.code);
                        templateSelector.value = ""; 
                        showTemplateDialog(parsedBlocks, templateData);
                    }
                }));
            }(originalTextarea, iframeDoc, iframeWin));
        } else {
            console.error("Target note textarea not found inside iframe (Expected selector: " + originalTextareaSelector + ").");
        }
    }

    /**
     * Parses a raw template string into a series of default and optional blocks[cite: 1].
     */
    function parseTemplateIntoBlocks(rawTemplateString) {
        const blocks = [];
        const optionalRegex = /\{\{(optional):([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
        let optionalMatch,
            lastIndex = 0;

        for (; optionalMatch = optionalRegex.exec(rawTemplateString);) {
            const precedingContent = rawTemplateString.substring(lastIndex, optionalMatch.index);
            if (precedingContent.trim() !== "") {
                blocks.push({
                    type: "default",
                    content: parseTemplateContent(precedingContent)
                });
            }

            blocks.push({
                type: "optional",
                label: optionalMatch[2],
                content: parseTemplateContent(optionalMatch[3])
            });

            lastIndex = optionalRegex.lastIndex;
        }

        const remainingContent = rawTemplateString.substring(lastIndex);
        if (remainingContent.trim() !== "") {
            blocks.push({
                type: "default",
                content: parseTemplateContent(remainingContent)
            });
        }

        return blocks;
    }

})();