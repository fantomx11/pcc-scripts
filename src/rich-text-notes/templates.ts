import { ParsedTemplateBlock, ParsedTemplateContent, TemplateDefinition, TemplateSection } from './types';

export const templates: Record<string, TemplateDefinition> = {
  'action-item': {
    text: 'Action Item',
    subjectPrefix: null,
    code: '<b>Action item(s)</b><br><ul>{{repeat:Action Items}}<li>[Action item]</li>{{/repeat}}</ul>{{optional:a}}<b>Next steps</b><br><ul>{{repeat:Next Steps}}<li>[Next step]</li>{{/repeat}}</ul>{{/optional}}'
  },
  'quote-block': {
    text: 'Quote Block',
    subjectPrefix: null,
    code: '{{optional:a}}[Pre Quote]:<br><br>{{/optional}}<i style="color: gray; font-style: italic;">[quote]</i><br>{{optional:b}}<br>[Post Quote]<br>{{/optional}}'
  },
  'qa-response': {
    text: 'QA Response',
    subjectPrefix: null,
    code: '{{repeat:Note}}<i style="color: gray;">[QA Note]</i><br><br>{Response}<br><br>{{/repeat}}'
  },
  'communication-template': {
    text: 'Communication',
    subjectPrefix: null,
    code: '<i>[description]</i><br>{{optional:b}}<br><b>Topics discussed</b><ul>{{repeat:Topics Discussed}}<li>[Topic]</li>{{/repeat}}</ul>{{/optional}}{{optional:a}}<b>Follow up needed</b><br><ul>{{repeat:Follow ups needed}}<li>[Follow up]</li>{{/repeat}}</ul>{{/optional}}'
  },
  'email-template': {
    text: 'Email',
    subjectPrefix: null,
    code: '<table><tbody><tr><td><b>from:</b></td><td>[from]</td></tr><tr><td><b>to:</b></td><td>[to]</td></tr>{{optional:b}}<tr><td><b>cc:</b></td><td>[cc]</td></tr>{{/optional}}{{optional:c}}<tr><td><b>sent:</b></td><td>[sent]</td></tr>{{/optional}}{{optional:a}}<tr><td><b>subject:</b></td><td>[subject]</td></tr>{{/optional}}</tbody></table><br>[body]'
  },
  'estimate-update': {
    text: 'Estimate Updated',
    subjectPrefix: 'Estimate Updated',
    code: '<ul><li><b>Estimate amount updated to [New Estimate Amount]</b></li>{{optional:Notes}}{{repeat:Notes}}<li>[Note]</li>{{/repeat}}{{/optional}}</ul>'
  },
  'initial-report': {
    text: 'Initial Report',
    subjectPrefix: 'Initial Report',
    code: '<i>[Narrative]</i><br><br>{{optional:a}}<b>Initial Observations</b><br><ul>{{repeat:Observations}}<li>[observation]</li>{{/repeat}}</ul>{{/optional}}{{optional:b}}<b>Initial Scope</b><br><ul>{{repeat:Scope Items}}<li>[scope item]</li>{{/repeat}}</ul>{{/optional}}'
  },
  'status-update': {
    text: 'Status Update',
    subjectPrefix: 'Project Status',
    code: "<b>Weekly Project Update [Date]</b><br>{{optional:b}}<br><b>This Week’s Activities:</b><br><ul>{{repeat:This week's activities}}<li>[This Week's Activity]</li>{{/repeat}}</ul>{{/optional}}{{optional:c}}<br><b>Activities for Next Week:</b><ul>{{repeat:Next week's activities}}<li>[Next Week's Activity]</li>{{/repeat}}</ul>{{/optional}}{{optional:a}}<br><b>Issues/Risks:</b><ul>{{repeat:Issues/Risks}}<li>[Issue]</li>{{/repeat}}</ul>{{/optional}}"
  },
  'site-visit': {
    text: 'Site Visit',
    subjectPrefix: 'Site Visit',
    code: '<b>Site Visit Report</b><br><b>Purpose:</b> [Purpose of Visit]{{optional:a}}<br><br><b>Observations:</b><br><ul>{{repeat:Observations}}<li>[Observation Detail]</li>{{/repeat}}</ul>{{/optional}}'
  },
  'invoice-update': {
    text: 'Invoice Updated',
    subjectPrefix: 'Invoice Updated',
    code: 'Updated invoice to reconcile with estimate. Emailed to: [Email recipients].'
  },
  'check-received': {
    text: 'Check Received',
    subjectPrefix: 'Check received',
    code: 'Received check [Check number]. [Other notes]'
  }
};

export function parseTemplateContent(templateString: string): ParsedTemplateContent {
  const variables: string[] = [];
  const sections: TemplateSection[] = [];
  const repeatRegex = /\{\{(repeat):([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/;
  let repeatMatch: RegExpExecArray | null;
  let remainingString = templateString;

  while ((repeatMatch = repeatRegex.exec(remainingString)) !== null) {
    const section: TemplateSection = {
      type: repeatMatch[1],
      label: repeatMatch[2],
      content: repeatMatch[3],
      variables: []
    };

    let variableMatchInside: RegExpExecArray | null;
    const sectionContent = section.content;
    const variableRegexInside = /\[([^\]]+)\]/g;
    while ((variableMatchInside = variableRegexInside.exec(sectionContent)) !== null) {
      section.variables.push(variableMatchInside[1]);
    }

    sections.push(section);
    remainingString = remainingString.replace(repeatMatch[0], `{{section:${section.label}}}`);
    repeatRegex.lastIndex = 0;
  }

  const variableRegex = /\[([^\]]+)\]/g;
  let variableMatch: RegExpExecArray | null;
  while ((variableMatch = variableRegex.exec(remainingString)) !== null) {
    variables.push(variableMatch[1]);
  }

  return {
    variables: variables.filter((v, i, a) => a.indexOf(v) === i),
    sections,
    templateString: remainingString
  };
}

export function parseTemplateIntoBlocks(rawTemplateString: string): ParsedTemplateBlock[] {
  const blocks: ParsedTemplateBlock[] = [];
  const optionalRegex = /\{\{(optional):([^}]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let optionalMatch: RegExpExecArray | null;
  let lastIndex = 0;

  while ((optionalMatch = optionalRegex.exec(rawTemplateString)) !== null) {
    const precedingContent = rawTemplateString.substring(lastIndex, optionalMatch.index);
    if (precedingContent.trim() !== '') {
      blocks.push({
        type: 'default',
        content: parseTemplateContent(precedingContent)
      });
    }

    blocks.push({
      type: 'optional',
      label: optionalMatch[2],
      content: parseTemplateContent(optionalMatch[3])
    });

    lastIndex = optionalRegex.lastIndex;
  }

  const remainingContent = rawTemplateString.substring(lastIndex);
  if (remainingContent.trim() !== '') {
    blocks.push({
      type: 'default',
      content: parseTemplateContent(remainingContent)
    });
  }

  return blocks;
}

export function showTemplateDialog(
  parsedTemplateBlocks: ParsedTemplateBlock[],
  templateConfig: TemplateDefinition,
  onInsert: (output: string, subjectPrefix: string | null) => void
): void {
  const dialog = document.createElement('dialog');
  dialog.style.cssText = `
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
    <div style="padding: 12px; position: relative; background-color: #EBEBEB; border-bottom: 1px solid #C0C0C0;">
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

  const templateBlockGenerators: (() => string)[] = [];
  const contentWrapper = dialog.querySelector('div:first-child') as HTMLElement;

  parsedTemplateBlocks.forEach(({ content: templateBlockContent, type: templateBlockType, label: templateBlockLabel }) => {
    const form = document.createElement('form');
    form.style.cssText = `
      padding: 12px;
      border: 1px solid #C0C0C0;
      border-radius: 0;
      margin: 12px;
      background-color: #F0F0F0;
    `;

    if (templateBlockType === 'optional' && templateBlockLabel) {
      const optionalToggleDiv = document.createElement('div');
      optionalToggleDiv.style.marginBottom = '8px';
      const checkbox = optionalToggleDiv.appendChild(document.createElement('input'));
      checkbox.type = 'checkbox';
      checkbox.id = `toggle-${templateBlockLabel}`;
      checkbox.checked = true;

      const label = optionalToggleDiv.appendChild(document.createElement('label'));
      label.textContent = `Include optional section: ${templateBlockLabel}`;
      label.htmlFor = `toggle-${templateBlockLabel}`;
      label.style.cssText = 'font-weight: bold; font-size: 11px; margin-left: 5px; color: #333;';

      form.appendChild(optionalToggleDiv);

      checkbox.addEventListener('change', () => {
        form.querySelectorAll<HTMLTextAreaElement | HTMLButtonElement>('textarea, button').forEach((el) => {
          el.disabled = !checkbox.checked;
        });
      });
    }

    templateBlockContent.variables.forEach((variableName) => {
      const div = document.createElement('div');
      div.style.marginBottom = '8px';

      const label = div.appendChild(document.createElement('label'));
      label.textContent = variableName;
      label.style.cssText = 'display: block; font-weight: bold; font-size: 11px; margin-bottom: 3px; color: #333;';

      const textarea = div.appendChild(document.createElement('textarea'));
      textarea.name = variableName;
      textarea.style.cssText = 'width: 100%; padding: 3px; border: 1px solid #7F9DB9; border-radius: 0; box-sizing: border-box; font-size: 11px;';
      form.appendChild(div);
    });

    templateBlockContent.sections.forEach((section) => {
      const sectionDiv = document.createElement('div');
      sectionDiv.style.cssText = 'border-top: 1px solid #C0C0C0; padding-top: 12px; margin-top: 12px;';

      if (section.type === 'repeat') {
        sectionDiv.innerHTML = `<h3 style="font-weight: bold; font-size: 12px; margin-bottom: 8px;">${section.label} (Repeating)</h3>`;

        const addButton = document.createElement('span');
        addButton.textContent = 'Add Item';
        addButton.setAttribute('role', 'button');
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

        const repeatItemsContainer = document.createElement('div');
        repeatItemsContainer.style.cssText = 'border: 1px solid #C0C0C0; padding: 6px; border-radius: 0; background-color: white; margin-top: 6px; display: flex; flex-direction: column; gap: 8px;';

        sectionDiv.appendChild(repeatItemsContainer);
        sectionDiv.appendChild(addButton);
        form.appendChild(sectionDiv);

        addButton.addEventListener('click', (event) => {
          event.stopPropagation();
          event.preventDefault();

          const itemDiv = document.createElement('div');
          itemDiv.style.cssText = 'padding: 6px; border: 1px solid #D0D0D0; background-color: #F8F8F8;';

          section.variables.forEach((variableName) => {
            const label = document.createElement('label');
            label.textContent = variableName;
            label.style.cssText = 'display: block; font-size: 11px; margin-bottom: 3px; margin-top: 6px;';

            const textarea = document.createElement('textarea');
            textarea.name = `${section.type}[${repeatItemsContainer.children.length}][${variableName}]`;
            textarea.style.cssText = 'width: 100%; padding: 3px; border: 1px solid #7F9DB9; box-sizing: border-box; font-size: 11px;';

            itemDiv.appendChild(label);
            itemDiv.appendChild(textarea);
          });
          repeatItemsContainer.appendChild(itemDiv);
        });
      }
    });

    templateBlockGenerators.push(() => {
      const formData = new FormData(form);

      function fillTemplate(): string {
        let resultString = templateBlockContent.templateString;

        templateBlockContent.variables.forEach((variableName) => {
          const value = (formData.get(variableName) as string) || '';
          resultString = resultString.replace(new RegExp(`\\[${variableName}\\]`, 'g'), value.replace(/\r\n?|\n/g, '<br>'));
        });

        templateBlockContent.sections.forEach((section) => {
          let sectionOutput = '';
          if (section.type === 'repeat') {
            let itemIndex = 0;
            const firstVariable = section.variables[0];

            while (formData.has(`${section.type}[${itemIndex}][${firstVariable}]`)) {
              let itemString = section.content;

              section.variables.forEach((variableName) => {
                const itemValue = (formData.get(`${section.type}[${itemIndex}][${variableName}]`) as string) || '';
                itemString = itemString.replace(new RegExp(`\\[${variableName}\\]`, 'g'), itemValue.replace(/\r\n?|\n/g, '<br>'));
              });

              sectionOutput += itemString;
              itemIndex++;
            }
          }
          resultString = resultString.replace(new RegExp(`{{section:${section.label}}}`, 'g'), sectionOutput);
        });

        return resultString;
      }

      if (templateBlockType === 'default') {
        return fillTemplate();
      } else if (templateBlockType === 'optional' && templateBlockLabel) {
        const toggleEl = form.querySelector(`#toggle-${templateBlockLabel}`) as HTMLInputElement | null;
        const isChecked = toggleEl?.checked ?? false;
        const hasStandardVars = templateBlockContent.variables.some(
          (varName) => ((formData.get(varName) as string) || '').trim() !== ''
        );
        const hasRepeatVars = templateBlockContent.sections.some(
          (section) => section.type === 'repeat' && formData.has(`repeat[0][${section.variables[0]}]`)
        );

        if (isChecked && (hasStandardVars || hasRepeatVars)) {
          return fillTemplate();
        }
      }

      return '';
    });

    contentWrapper.appendChild(form);
  });

  const insertButton = document.createElement('span');
  insertButton.setAttribute('role', 'button');
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
  insertButton.textContent = 'Insert Template';

  contentWrapper.appendChild(insertButton);
  document.body.appendChild(dialog);
  dialog.showModal();

  dialog.querySelector('.close-button')?.addEventListener('click', () => {
    dialog.close();
    dialog.remove();
  });

  insertButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const finalOutput = templateBlockGenerators.reduce((acc, generator) => acc + generator(), '');
    onInsert(finalOutput, templateConfig.subjectPrefix);

    dialog.close();
    dialog.remove();
  });
}