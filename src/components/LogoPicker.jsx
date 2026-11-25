// Small "Add logo" tile for a job or school (shown when the template uses logos).
import { useRef, useState } from 'react';
import { readLogo, initialsOf } from '../lib/logo';

export default function LogoPicker({ value, name, label = 'Company logo', onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);

  async function pick(file) {
    if (!file) return;
    setBusy(true);
    setError('');
    try { onChange(await readLogo(file)); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="field full logo-field">
      <label>{label} <span className="opt">(optional)</span></label>
      <div className="logo-row">
        <button
          type="button" className={`logo-tile ${drag ? 'drag' : ''} ${value ? 'has' : ''}`} onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          aria-label={value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
        >
          {busy ? <span className="spinner sm" /> : value ? <img src={value} alt="" /> : <span className="logo-initials">{initialsOf(name) || '+'}</span>}
        </button>
        <div className="logo-text">
          <div className="logo-actions">
            <button type="button" className="link-btn" onClick={() => fileRef.current?.click()} disabled={busy}>{value ? 'Change logo' : 'Upload logo'}</button>
            {value && <button type="button" className="link-btn danger" onClick={() => onChange('')}>Remove</button>}
          </div>
          <span className="help">PNG, JPG, SVG or WebP. A square logo looks best. Without one, initials are shown.</span>
          {error && <span className="form-error">{error}</span>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*,.svg" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(f); }} />
    </div>
  );
}
