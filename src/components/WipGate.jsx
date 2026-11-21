import { useState } from 'react';
import { tryUnlockUpload } from '../lib/wip';
import Modal from './Modal';

function LockForm({ onUnlock, onCancel }) {
  const [pw, setPw] = useState('');
  const [wrong, setWrong] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (tryUnlockUpload(pw)) onUnlock();
    else { setWrong(true); setPw(''); }
  };
  return (
    <form onSubmit={submit} className="wip-form">
      <div className="wip-badge">🚧 Work in progress</div>
      <p>We’re still building <b>Upload resume</b>. It isn’t ready for everyone yet — enter the password to try it.</p>
      <input
        className={`wip-input ${wrong ? 'wrong' : ''}`}
        type="password" inputMode="numeric" autoComplete="off" maxLength={12} autoFocus
        value={pw} onChange={(e) => { setPw(e.target.value); setWrong(false); }}
        placeholder="Enter password" aria-label="Password"
      />
      {wrong && <div className="wip-error">That’s not the right password.</div>}
      <div className="wip-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary" disabled={!pw}>Unlock</button>
      </div>
    </form>
  );
}

// Pop-up version (used by the Upload tile).
export default function WipGate({ onUnlock, onClose }) {
  return (
    <Modal title="Coming soon" onClose={onClose}>
      <LockForm onUnlock={onUnlock} onCancel={onClose} />
    </Modal>
  );
}

// Full-page version (used if someone opens an uploaded resume while it's locked).
export function WipPage({ onUnlock, onBack }) {
  return (
    <div className="center-screen wip-page">
      <div className="leave-card" style={{ textAlign: 'center' }}>
        <h3 style={{ marginBottom: 12 }}>Coming soon</h3>
        <LockForm onUnlock={onUnlock} onCancel={onBack} />
      </div>
    </div>
  );
}
