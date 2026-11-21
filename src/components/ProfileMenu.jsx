import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { beforeLeave } from '../lib/leaveGuard';
import { Avatar } from './ui';
import EditProfileModal from './EditProfileModal';
import ShareModal, { shareSite } from './ShareModal';

const I = {
  user: <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />,
  share: <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />,
  grid: <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />,
  spark: <path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z" />,
  help: <path d="M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01" />,
  out: <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />,
};
const Ic = ({ d }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

// Avatar button in the top bar → Edit profile, Share website, Sign out (and a few extras).
export default function ProfileMenu() {
  const { user, signOut, demo } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'profile' | 'share'
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
          <button role="menuitem" onClick={pick(() => shareSite(() => setDialog('share')))}><Ic d={I.share} />Share website</button>
          <div className="pmenu-sep" />
          <Link role="menuitem" to="/app" onClick={() => setOpen(false)}><Ic d={I.grid} />My resumes</Link>
          <Link role="menuitem" to="/changelog" onClick={() => setOpen(false)}><Ic d={I.spark} />What’s new</Link>
          <Link role="menuitem" to="/#faq" onClick={() => setOpen(false)}><Ic d={I.help} />Help &amp; FAQ</Link>
          <div className="pmenu-sep" />
          <button role="menuitem" className="danger" onClick={pick(async () => { if (!(await beforeLeave())) return; await signOut(); navigate('/'); })}>
            <Ic d={I.out} />{demo ? 'Exit demo' : 'Sign out'}
          </button>
        </div>
      )}

      {dialog === 'profile' && <EditProfileModal onClose={() => setDialog(null)} />}
      {dialog === 'share' && <ShareModal onClose={() => setDialog(null)} />}
    </div>
  );
}

// Stand-alone "Share" button for top bars.
export function ShareButton({ className = 'btn btn-ghost btn-sm' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className} onClick={() => shareSite(() => setOpen(true))} title="Share this website">
        <Ic d={I.share} /><span className="hide-xs">Share</span>
      </button>
      {open && <ShareModal onClose={() => setOpen(false)} />}
    </>
  );
}
