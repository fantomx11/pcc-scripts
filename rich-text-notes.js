(function() {
    // Initialized outside of the main function to hold state and be accessible by other functions if needed.
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
     * Parses a string for repeat sections and variables.
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
     * Creates and displays the template filling dialog.
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
            background-color: #ECECEC; /* Classic light gray background */
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

                    // Using a span instead of a button to prevent global event conflicts
                    const addButton = document.createElement("span"); 
                    addButton.textContent = "Add Item";
                    addButton.setAttribute("role", "button");
                    addButton.style.cssText = `
                        /* Styled to look like a button */
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
                        event.stopPropagation(); // Prevent bubbling 
                        event.preventDefault(); // Prevent default if role="button" is mistaken for a submit

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

        // Using a span instead of a button to prevent global event conflicts
        const insertButton = document.createElement("span"); 
        insertButton.setAttribute("role", "button");
        insertButton.style.cssText = `
            /* Styled to look like a button */
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
            event.stopPropagation(); // Prevent bubbling 

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

    // --- Template Definitions (unchanged) ---
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
        "invoice-update": {
            text: "Invoice Updated",
            subjectPrefix: "Invoice Updated",
            code: "<ul><li><b>Invoice amount updated to [New Invoice Amount]</b></li>{{optional:a}}{{repeat:Notes}}<li>[Note]</li>{{/repeat}}{{/optional}}</ul>{{optional:1}}<div><b>Scope Updates</b></div><ul>{{repeat:Scope Updates}}<li>[Scope Change]</li>{{/repeat}}</ul>{{/optional}}"
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
        }
    };

    /**
     * Attempts to find and manipulate the host application's iframe/modal container.
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
                width: 100%;
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

                // Helper to update the character counter's text and color
                function updateCharCounter(textarea, counterElement, limit) {
                    const count = textarea.value.length;
                    
                    // Only display the limit and apply color if LIMIT is a finite number
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
                        // Private note: Do not show a limit, and keep the color normal
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
                    if (sourceTextarea && counter) {
                        updateCharCounter(sourceTextarea, counter);
                    }
                };

                const updateSourceFromEditor = function() {
                    const sourceTextarea = doc.getElementById("TemplateSource");
                    const editableContent = doc.getElementById("editable-content");
                    const counter = doc.getElementById("char-counter");
                    const toast = doc.getElementById("char-limit-warning"); 
    
                    const submitButton1 = doc.getElementById("AddNotesUserControl_AddButton2");
                    const submitButton2 = doc.getElementById("AddNotesUserControl_AddButton");
    
                    // --- Determine the Limit based on Visibility ---
                    const visibilityInput = doc.querySelector('input[name="AddNotesUserControl$VisibilityControl$radCombo_ObjectOwnershipType"]');
                    const isPublic = visibilityInput && visibilityInput.value === "Public";
                    
                    // Limit is 3700 for public notes, and Infinity for all others (no limit).
                    const LIMIT = isPublic ? 3700 : Infinity;
                    
                    if (sourceTextarea && editableContent) {
                        var cleanedHtml = cleanHtml([...editableContent.childNodes]);
                        const currentLength = cleanedHtml.length; // Get length *after* cleaning                        

                        // --- Limit Enforcement Logic ---
                        const isOverLimit = currentLength > LIMIT;
                        
                        if (isOverLimit) {
                            // 1. Show persistent toast
                            if (toast) {
                                toast.style.display = 'block';
                            }
                            // 2. Disable submit buttons
                            if (submitButton1) submitButton1.disabled = true;
                            if (submitButton2) submitButton2.disabled = true;
                            
                        } else {
                            // 1. Hide persistent toast
                            if (toast) {
                                toast.style.display = 'none';
                            }
                            // 2. Enable submit buttons
                            if (submitButton1) submitButton1.disabled = false;
                            if (submitButton2) submitButton2.disabled = false;
                        }
                        
                        // --- Sync ---
                        if (sourceTextarea.value !== cleanedHtml) {
                            sourceTextarea.value = cleanedHtml;
                        }
                    }
                    
                    if (sourceTextarea && counter) {
                        // Pass the dynamic limit to the counter update function
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

                // --- NEW CSS: Equal Width and Counter Styling ---
                const customStyle = doc.createElement("style");
                customStyle.textContent = `
                    /* Container for the Split View */
                    .editor-split-container {
                        display: flex;
                        height: 400px;
                        gap: 16px;
                        width: 100%;
                    }
                    #editable-wrapper, #source-wrapper {
                        display: flex;
                        flex-direction: column;
                        flex-grow: 1;
                        min-width: 0;
                        /* Set flex-basis to ensure equal width */
                        flex-basis: 50%;
                    }
                    /* Styling for the original textarea, now used as source */
                    #TemplateSource {
                        height: 100%;
                        min-height: 400px;
                        font-family: Consolas, monospace;
                        font-size: 11px;
                        resize: none;
                        padding: 4px;
                        border: 1px inset #C0C0C0;
                        background-color: white;
                    }
                    /* Custom Editor Styles (unchanged) */
                    #editor-container {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        border: 1px inset #C0C0C0;
                        border-radius: 0;
                        background-color: white;
                    }
                    #custom-toolbar {
                        flex-shrink: 0;
                        border-bottom: 1px solid #C0C0C0;
                        padding: 2px;
                        background-color: #EBEBEB;
                        border-radius: 0;
                    }
                    /* --- UPDATED: Use span instead of button to avoid global event conflicts --- */
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
                        display: inline-block; /* Treat as block/inline-block for spacing/padding */
                        user-select: none; /* Prevent selection when clicking */
                    }
                    #custom-toolbar .custom-cmd-btn:active {
                        border: 1px inset #C0C0C0;
                        background-color: #D0D0D0;
                    }
                    #editable-content {
                        flex-grow: 1;
                        overflow-y: auto;
                        padding: 4px;
                        min-height: 350px;
                        outline: none;
                        font-family: Tahoma, Verdana, Segoe, sans-serif;
                        font-size: 11px;
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
                    /* Styling for the Character Counter */
                    #char-counter {
                        font-size: 10px;
                        margin-top: 4px;
                        text-align: right;
                    }

                    /* Persistent Toast Notification */
                    #char-limit-warning {
                        position: fixed; /* Fixed relative to the iframe window */
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        padding: 8px 15px;
                        background-color: #A00000; /* Dark Red Background */
                        color: white;
                        font-weight: bold;
                        border: 2px solid #FFCCCC;
                        border-radius: 4px;
                        z-index: 10000; /* Ensure it is on top of everything */
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                        display: none; /* Hidden by default */
                        font-size: 14px;
                        text-align: center;
                    }                    
                `;
                doc.head.appendChild(customStyle);

                // --- NEW HTML: Replaced buttons with spans ---
                const newRow = doc.createElement("tr");
                newRow.innerHTML = `
                    <td style="vertical-align: top; font-size: 11px; font-weight: bold; padding: 8px;">Template/Editor:</td>
                    <td style="padding: 8px; width: 100%;">
                        <div id="template-controls">
                            <label for="template-selector">Choose Template:</label>
                            <select id="template-selector"></select>
                        </div>

                        <div class="editor-split-container">
                            <div id="editable-wrapper">
                                <label style="display: block; font-size: 11px; font-weight: bold; margin-bottom: 4px;">Formatted Note</label>
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
                                <label for="TemplateSource" style="display: block; font-size: 11px; font-weight: bold; margin-bottom: 4px;">HTML Source Code</label>
                                <div id="source-elements" style="display: flex; flex-direction: column; height: 100%; width: 100%;">
                                    </div>
                                <div id="char-counter" style="font-size: 11px; margin-top: 4px; text-align: right;">Character Count: 0</div>
                            </div>
                        </div>
                    </td>
                `;

                originalRow.parentNode.replaceChild(newRow, originalRow);

                // Attach the original textarea and the character counter
                const sourceElementsDiv = newRow.querySelector("#source-elements");
                const charCounterElement = newRow.querySelector("#char-counter");
                sourceElementsDiv.appendChild(originalTextarea);


                const toolbar = doc.getElementById("custom-toolbar");
                // *** UPDATED: Target the new .custom-cmd-btn spans ***
                Array.from(toolbar.querySelectorAll(".custom-cmd-btn")).forEach((span) => { 
                    const command = span.getAttribute("data-cmd");
                    if (command) {
                        span.addEventListener("click", ((event) => {
                            event.preventDefault(); // Stop default behavior
                            event.stopPropagation(); // Stop event from bubbling up to host app 

                            // FIX: Ensure the visual editor has the latest source before acting on it.
                            updateEditorFromSource(); 

                            doc.execCommand(command, false, null);
                            doc.getElementById("editable-content").focus();
                            updateSourceFromEditor();
                        }));
                    }
                });

                const editableContentDiv = doc.getElementById("editable-content");
                updateEditorFromSource(); // Initial sync

                if (visibilityInput) {
                    // Use 'change' event to detect when the user selects a new visibility option
                    visibilityInput.addEventListener("change", updateSourceFromEditor);
                    
                    // Also run it on load to check the initial state
                    updateSourceFromEditor();
                }

                // Add event listeners for synchronization and character counting
                editableContentDiv.addEventListener("input", updateSourceFromEditor);
                originalTextarea.addEventListener("input", updateEditorFromSource);

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
     * Parses a raw template string into a series of default and optional blocks.
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
