const { useState, useEffect } = await import('https://esm.sh/preact/hooks');
const { html, formatDateForInput } = await import("../modules/lib.js");
const { ModalField, ModalSelect } = await import("./ModalField.js");

const ModalFields = [
  { isCms: false, name: "url",          type: "text",   label: "Job Slideboard URL",              value: formData => formData.url },
  { isCms: false, name: "jobNumber",    type: "text",   label: "Job #",                           value: formData => formData.jobNumber },

  { isCms: false, name: "type",         type: "select", label: "Type",                            value: formData => formData.type, options: [{ label: 'Supplement', value: 'SUPP' }, { label: 'Change Order', value: 'CO' }] },
  { isCms: false, name: "description",  type: "text",   label: "Description",                     value: formData => formData.description },

  { isCms: false, name: "received",     type: "date",   label: "Date Received",                   value: formData => formatDateForInput(formData.received) },
  { isCms: false, name: "inspected",    type: "date",   label: "Date Inspected",                  value: formData => formatDateForInput(formData.inspected) },
  { isCms: false, name: "workAuth",     type: "date",   label: "Date Signed/Auth (Clears Badge)", value: formData => formatDateForInput(formData.workAuth) || '' },
  { isCms: false, name: "sent",         type: "date",   label: "Date Estimate Sent",              value: formData => formatDateForInput(formData.sent) },
  { isCms: true,  name: "reviewed",     type: "date",   label: "Estimate Reviewed",               value: formData => formatDateForInput(formData.reviewed) },
  { isCms: true,  name: "lastFollowUp", type: "date",   label: "Last Follow Up",                  value: formData => formatDateForInput(formData.lastFollowUp) },
  { isCms: true,  name: "lastContact",  type: "date",   label: "Last Contact",                    value: formData => formatDateForInput(formData.lastContact) },
  { isCms: false, name: "approved",     type: "date",   label: "Date Estimate Approved",          value: formData => formatDateForInput(formData.approved) }
];

export const Modal = ({ estimate, onClose, onSave, onDelete }) => {
  // Local state for the form fields
  const [formData, setFormData] = useState({ ...estimate });
  const isCms = estimate.type === 'CMS';
  const isNew = !estimate.uniqueId || estimate.uniqueId.startsWith('new-');

  const handleInput = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target.className === 'modal-overlay' && onClose()}>
      <div class="modal-box" onClick=${(e) => e.stopPropagation()}>
        <h3 style="margin-top:0">
          ${isCms ? 'Log CMS Contact' : (isNew ? 'Add Supplement/CO' : 'Edit Local Entry')}
        </h3>

        ${ModalFields.filter(field => isCms ? field.isCms : true).map(field => html`
          <${ModalField} 
            key=${field.name}
            label=${field.label} 
            name=${field.name} 
            type=${field.type} 
            value=${field.value(formData)} 
            handleInput=${handleInput} 
            options=${field.options}
          />
        `)} 

        <div class="modal-btns">
          ${(!isNew && !isCms) && html`
            <button class="btn-delete" onClick=${() => onDelete(formData.uniqueId)} style="margin-right:auto;">Delete</button>
          `}
          <button class="btn-cancel" onClick=${onClose}>Cancel</button>
          <button class="btn-save" onClick=${() => onSave(formData)}>Save</button>
        </div>
      </div>
    </div>
  `;
};