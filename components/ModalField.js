const {html} = await import("../modules/lib.js");

export const ModalField = ({ label, type, name, value, handleInput, options }) => {

  return html`
    <div class="modal-field">
      <label>${label}</label>
      ${(type === 'select') ?
        html`
          <select name="${name}"
            value=${value}
            onInput=${handleInput}>
            ${options.map(opt => html`
              <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>
            `)}
          </select>` :
        html`
          <input type="${type}" name="${name}" value=${value ? value : ''} onInput=${handleInput} />
        `}
    </div>
  `;
};