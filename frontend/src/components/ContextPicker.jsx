import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';

export default function ContextPicker({ label, value, options, onChange, disabled = false, icon }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const panelId = useId();
  const selected = options.find(option => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const keydown = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        root.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keydown);
    };
  }, [open]);

  if (!selected) return null;
  return <div className="context-picker" ref={root}>
    <span className="context-picker-label">{label}</span>
    <button type="button" className="context-picker-trigger" disabled={disabled} aria-label={`${label}: ${selected.label}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>
      {icon && <Icon name={icon} />}
      {label === 'You' && <span className="avatar" aria-hidden="true">{selected.label.slice(0, 1)}</span>}
      <span className="context-picker-value">{selected.label}</span>
      <Icon name="chevron" />
    </button>
    {open && <div className="context-picker-panel" id={panelId} role="group" aria-label={`Choose ${label.toLowerCase()}`}>
      {options.map(option => <button key={option.value} type="button" className="context-picker-option" aria-pressed={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }}>
        <span>{option.label}</span>{option.value === value && <Icon name="check" />}
      </button>)}
    </div>}
  </div>;
}
