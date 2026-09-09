export interface SelectOption {
  label: string;
  value: string;
}

export interface ModalFieldProps {
  label: string;
  type: string;
  name: string;
  value?: string | number | null;
  handleInput: (e: Event) => void;
  options?: SelectOption[];
}

export const ModalField = ({
  label,
  type,
  name,
  value,
  handleInput,
  options = [],
}: ModalFieldProps) => {
  return (
    <div class="modal-field">
      <label>{label}</label>
      {type === 'select' ? (
        <select name={name} value={value ?? ''} onInput={handleInput}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} selected={opt.value === value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value ?? ''}
          onInput={handleInput}
        />
      )}
    </div>
  );
};

export const ModalSelect = ModalField;