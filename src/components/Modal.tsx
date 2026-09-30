import { useState } from 'preact/hooks';
import type { Estimate } from '../classes/Estimate';
import { formatDateForInput } from '../modules/lib';
import { ModalField, type SelectOption } from './ModalField';

interface ModalFieldConfig {
  isCms: boolean;
  name: string;
  type: string;
  label: string;
  value: (formData: Record<string, any>) => any;
  options?: SelectOption[];
}

const ModalFields: ModalFieldConfig[] = [
  { isCms: false, name: 'jobNumber', type: 'text', label: 'Job #', value: formData => formData.jobNumber },
  {
    isCms: false,
    name: 'type',
    type: 'select',
    label: 'Type',
    value: formData => formData.type,
    options: [
      { label: 'Supplement', value: 'SUPP' },
      { label: 'Change Order', value: 'CO' },
    ],
  },
  { isCms: false, name: 'description', type: 'text', label: 'Description', value: formData => formData.description },
  { isCms: false, name: 'received', type: 'date', label: 'Date Received', value: formData => formatDateForInput(formData.received) },
  { isCms: false, name: 'inspected', type: 'date', label: 'Date Inspected', value: formData => formatDateForInput(formData.inspected) },
  { isCms: false, name: 'workAuth', type: 'date', label: 'Date Signed/Auth (Clears Badge)', value: formData => formatDateForInput(formData.workAuth) || '' },
  { isCms: false, name: 'sent', type: 'date', label: 'Date Estimate Sent', value: formData => formatDateForInput(formData.sent) },
  { isCms: true, name: 'reviewed', type: 'date', label: 'Estimate Reviewed', value: formData => formatDateForInput(formData.reviewed) },
  { isCms: true, name: 'lastFollowUp', type: 'date', label: 'Last Follow Up', value: formData => formatDateForInput(formData.lastFollowUp) },
  { isCms: true, name: 'lastContact', type: 'date', label: 'Last Contact', value: formData => formatDateForInput(formData.lastContact) },
  { isCms: false, name: 'approved', type: 'date', label: 'Date Estimate Approved', value: formData => formatDateForInput(formData.approved) },
];

interface ModalProps {
  estimate: Partial<Estimate> & Record<string, any>;
  estimates?: Estimate[];
  onClose: () => void;
  onSave: (formData: Record<string, any>) => void;
  onDelete: (id: string) => void;
}

export const Modal = ({
  estimate,
  estimates = [],
  onClose,
  onSave,
  onDelete,
}: ModalProps) => {
  const [formData, setFormData] = useState<Record<string, any>>({
    ...estimate,
    jobNumber: estimate.jobNumber || '',
  });
  const [searchTerm, setSearchTerm] = useState(estimate.jobNumber || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newBlocker, setNewBlocker] = useState('');

  const handleAddBlocker = () => {
    const text = newBlocker.trim();
    if (!text) return;
    setFormData((prev) => ({
      ...prev,
      blockers: [...(prev.blockers || []), text],
    }));
    setNewBlocker('');
  };

  const handleRemoveBlocker = (idxToRemove: number) => {
    setFormData((prev) => ({
      ...prev,
      blockers: (prev.blockers || []).filter((_: string, idx: number) => idx !== idxToRemove),
    }));
  };

  const isCms = estimate.type === 'CMS';
  const isNew = !estimate.uniqueId || String(estimate.uniqueId).startsWith('new-');

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    setFormData(prev => ({ ...prev, [target.name]: target.value }));
  };

  const activeJobs: { jobNumber: string; customer: string }[] = [];
  const seenJobs = new Set<string>();
  estimates.forEach(e => {
    if (e.isActive && e.jobNumber && !seenJobs.has(e.jobNumber)) {
      seenJobs.add(e.jobNumber);
      activeJobs.push({
        jobNumber: e.jobNumber,
        customer: e.customer || 'Unknown Customer',
      });
    }
  });

  const filteredJobs = searchTerm.trim() === ''
    ? activeJobs
    : activeJobs.filter(j =>
      j.jobNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.customer.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div
      class="modal-overlay"
      onClick={(e) => (e.target as HTMLElement).className === 'modal-overlay' && onClose()}
    >
      <div class="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          {isCms ? 'Log CMS Contact' : (isNew ? 'Add Supplement/CO' : 'Edit Local Entry')}
        </h3>

        {ModalFields.filter(field => (isCms ? field.isCms : true)).map(field => {
          if (field.name === 'jobNumber' && isNew) {
            return (
              <div key="jobNumber-autocomplete" class="modal-field autocomplete-container">
                <label>{field.label}</label>
                <input
                  type="text"
                  name="jobNumber"
                  value={searchTerm}
                  placeholder="Type customer name or job number..."
                  onInput={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    setSearchTerm(val);
                    setFormData(prev => ({ ...prev, jobNumber: val }));
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  autoComplete="off"
                />
                {isDropdownOpen && filteredJobs.length > 0 && (
                  <div class="autocomplete-dropdown">
                    {filteredJobs.map(job => (
                      <div
                        key={job.jobNumber}
                        class="autocomplete-item"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, jobNumber: job.jobNumber }));
                          setSearchTerm(job.jobNumber);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <strong>{job.customer}</strong>{' '}
                        <span style={{ color: '#7f8c8d', fontSize: '11px' }}>({job.jobNumber})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <ModalField
              key={field.name}
              label={field.label}
              name={field.name}
              type={field.type}
              value={field.value(formData)}
              handleInput={handleInput}
              options={field.options}
            />
          );
        })}

        {/* Blockers Management Section */}
        <div class="blockers-section">
          <label class="blockers-header">Blockers</label>
          
          {(formData.blockers || []).length > 0 ? (
            <ul class="blockers-list">
              {(formData.blockers as string[]).map((blocker, idx) => (
                <li key={idx} class="blocker-item">
                  <span class="blocker-text">{blocker}</span>
                  <button
                    type="button"
                    class="btn-remove-blocker"
                    onClick={() => handleRemoveBlocker(idx)}
                    title="Remove blocker"
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p class="no-blockers-text">No active blockers</p>
          )}

          <div class="add-blocker-row">
            <input
              type="text"
              placeholder="Describe what is blocking this estimate..."
              value={newBlocker}
              onInput={(e) => setNewBlocker((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddBlocker();
                }
              }}
            />
            <button type="button" class="btn-add-blocker" onClick={handleAddBlocker}>
              Add
            </button>
          </div>
        </div>

        <div class="modal-btns">
          {!isNew && !isCms && (
            <button
              class="btn-delete"
              onClick={() => onDelete(formData.uniqueId)}
              style={{ marginRight: 'auto' }}
            >
              Delete
            </button>
          )}
          <button class="btn-cancel" onClick={onClose}>Cancel</button>
          <button class="btn-save" onClick={() => onSave(formData)}>Save</button>
        </div>
      </div>
    </div>
  );
};