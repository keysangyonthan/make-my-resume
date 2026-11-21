import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { submitFeedback } from '../lib/store';
import { CREATOR_NAME } from '../config';
import Modal from './Modal';

const KINDS = [
  { key: 'idea', label: '💡 Idea' },
  { key: 'problem', label: '🐞 Problem' },
  { key: 'love', label: '❤️ Love it' },
  { key: 'other', label: '💬 Other' },
];

// "Contact me" form. Messages are saved to Firebase (feedback collection).
export default function FeedbackModal({ onClose }) {
  const { user } = useAuth() || {};
  const [kind, setKind] = useState('idea');
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | error

  const emailOk = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = message.trim().length > 0 && emailOk && state !== 'sending';

  async function send(e) {
    e.preventDefault();
    if (!canSend) return;
    setState('sending');
    try {
      await submitFeedback({ kind, name, email, message, uid: user?.uid && !user?.demo ? user.uid : '' });
      setState('sent');
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <Modal title="Thank you!" onClose={onClose}>
        <div className="fb-sent">
          <div className="fb-heart">❤️</div>
          <p>Your message reached {CREATOR_NAME}. {email.trim() ? 'If it needs a reply, you’ll hear back by email.' : ''}</p>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={`Contact ${CREATOR_NAME}`}
      subtitle="Ideas, problems, or just a hello — every message is read."
      onClose={onClose}
    >
      <form onSubmit={send} className="fb-form">
        <div className="fb-kinds" role="radiogroup" aria-label="Type of message">
          {KINDS.map((k) => (
            <button key={k.key} type="button" role="radio" aria-checked={kind === k.key}
              className={`fb-kind ${kind === k.key ? 'on' : ''}`} onClick={() => setKind(k.key)}>{k.label}</button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="fb-msg">Message</label>
          <textarea id="fb-msg" rows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder={kind === 'problem' ? 'What happened, and what did you expect?' : 'Tell me what you think…'} autoFocus />
        </div>
        <div className="grid2">
          <div className="field">
            <label htmlFor="fb-name">Name <span className="opt">(optional)</span></label>
            <input id="fb-name" type="text" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fb-email">Email <span className="opt">(optional)</span></label>
            <input id="fb-email" type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="If you’d like a reply" />
          </div>
        </div>
        {!emailOk && <p className="form-error">That email doesn’t look right.</p>}
        {state === 'error' && <p className="form-error">Couldn’t send right now. Please try again in a moment.</p>}
        <div className="fb-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!canSend}>{state === 'sending' ? 'Sending…' : 'Send message'}</button>
        </div>
      </form>
    </Modal>
  );
}
