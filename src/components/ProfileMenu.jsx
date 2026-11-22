import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { beforeLeave } from '../lib/leaveGuard';
import { Avatar } from './ui';
import EditProfileModal from './EditProfileModal';
import ShareModal, { shareSite } from './ShareModal';
import FeedbackModal from './FeedbackModal';
import { LinkedInLogo, LinkedInManage, linkedInOf } from './LinkedIn';

const I = {
  user: <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />,
  share: <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />,
  spark: <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />,
  help: <path d="M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01" />,
  chat: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />,
  out: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
};
const Ic = ({ d }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

// Avatar button in the top bar → Edit profile, What's new, Help, Send feedback, Sign out.
export default function ProfileMenu() {
  const { user, signOut, demo } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'profile' | 'feedback'
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!user) return null;
  const pick = (fn) => () => { setOpen(false); fn(); };

  return (
    <div className="pmenu" ref={ref}>
      <button className="pmenu-trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Avatar user={user} />
      </button>

      {open && (
        <div className="pmenu-pop" role="menu">
          <div className="pmenu-head">
            <Avatar user={user} />
            <div>
              <b>{user.name || (demo ? 'Guest' : 'Your account')}</b>
              <span>{user.email || (demo ? 'Demo mode — saved in this browser' : '')}</span>
            </div>
          </div>
          <button role="menuitem" onClick={pick(() => setDialog('profile'))}><Ic d={I.user} />Edit profile</button>
          <button role="menuitem" onClick={pick(() => setDialog('linkedin'))}>
            <span className="pm-li"><LinkedInLogo size={17} /></span>
            <span className="pm-two">LinkedIn<small>{linkedInOf(user) ? 'Linked · Update or unlink' : 'Not linked'}</small></span>
          </button>
          <div className="pmenu-sep" />
          <Link role="menuitem" to="/changelog" onClick={() => setOpen(false)}><Ic d={I.spark} />What’s new</Link>
          <Link role="menuitem" to="/#faq" onClick={() => setOpen(false)}><Ic d={I.help} />Help &amp; FAQ</Link>
          <button role="menuitem" onClick={pick(() => setDialog('feedback'))}><Ic d={I.chat} />Send feedback</button>
          <div className="pmenu-sep" />
          <button role="menuitem" className="danger" onClick={pick(async () => { if (!(await beforeLeave())) return; await signOut(); navigate('/'); })}>
            <Ic d={I.out} />{demo ? 'Exit demo' : 'Sign out'}
          </button>
        </div>
      )}

      {dialog === 'profile' && <EditProfileModal onClose={() => setDialog(null)} />}
      {dialog === 'feedback' && <FeedbackModal onClose={() => setDialog(null)} />}
      {dialog === 'linkedin' && <LinkedInManage onClose={() => setDialog(null)} />}
    </div>
  );
}

// Stand-alone "Share" button for top bars.
export function ShareButton({ className = 'btn btn-ghost btn-sm' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => shareSite(() => setOpen(true))} title="Share this website">
        <Ic d={I.share} /><span className="hide-xs">Share website</span>
      </button>
      {open && <ShareModal onClose={() => setOpen(false)} />}
    </>
  );
}
