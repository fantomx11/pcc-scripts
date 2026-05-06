const {html} = await import("../modules/libs.js");

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
        
        <div class="modal-field">
          <label>Last Follow Up (Resets Aging)</label>
          <input type="date" name="lastFollowUp" 
                value=${formatDateForInput(formData.lastFollowUp)} 
                onInput=${handleInput} />
        </div>

        ${!isCms && html`
          <hr style="border:0; border-top:1px solid #eee; margin:15px 0;" />
          <div class="modal-field">
            <label>Job #</label>
            <input type="text" name="jobNumber" value=${formData.jobNumber} onInput=${handleInput} />
          </div>
          <div class="modal-field">
            <label>Description</label>
            <input type="text" name="description" value=${formData.description} onInput=${handleInput} />
          </div>
          `}

        <div class="modal-btns">
          ${(!isNew && !isCms) && html`
            <button class="btn-delete" onClick=${() => onDelete(formData.uniqueId)} style="margin-right:auto;">
              Delete
            </button>
          `}
          <button class="btn-cancel" onClick=${onClose}>Cancel</button>
          <button class="btn-save" onClick=${() => onSave(formData)}>Save</button>
        </div>
      </div>
    </div>
  `;
};