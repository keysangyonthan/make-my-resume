import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { APP_NAME } from '../config';
import Modal from './Modal';

export const siteUrl = () => window.location.origin;
const MESSAGE = `I've been making my resume with ${APP_NAME} — free, simple, and it exports a clean PDF. Try it:`;

// Opens the phone's native share sheet when available; otherwise our share dialog.
export async function shareSite(openDialog) {
  const data = { title: APP_NAME, text: MESSAGE, url: siteUrl() };
  if (navigator.share && window.matchMedia?.('(pointer: coarse)').matches) {
    try { await navigator.share(data); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  openDialog();
}

export default function ShareModal({ onClose }) {
  const url = siteUrl();
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } }).then(setQr).catch(() => {});
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.getElementById('share-url');
      el?.select();
      document.execCommand?.('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const enc = encodeURIComponent;
  const targets = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${enc(`${MESSAGE} ${url}`)}`, color: '#25D366', icon: 'M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1.9 2 1.2 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z' },
    { name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`, color: '#0A66C2', icon: 'M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z' },
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${enc(MESSAGE)}&url=${enc(url)}`, color: '#000000', icon: 'M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z' },
    { name: 'Email', href: `mailto:?subject=${enc(`Try ${APP_NAME}`)}&body=${enc(`${MESSAGE}\n${url}`)}`, color: '#64748b', icon: 'M3 5h18a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1zm9 7.5L3.6 7v.1L12 13l8.4-5.9V7z' },
  ];

  return (
    <Modal title={`Share ${APP_NAME}`} subtitle="Help a friend build their resume — it’s free." onClose={onClose}>
      <div className="share-link">
        <input id="share-url" value={url} readOnly onFocus={(e) => e.target.select()} aria-label="Website link" />
        <button className={`btn btn-sm ${copied ? 'btn-white copied' : 'btn-primary'}`} onClick={copy}>{copied ? '✓ Copied' : 'Copy link'}</button>
      </div>
      <div className="share-targets">
        {targets.map((t) => (
          <a key={t.name} href={t.href} target="_blank" rel="noopener noreferrer" className="share-target">
            <span className="share-ic" style={{ background: t.color }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d={t.icon} /></svg>
            </span>
            {t.name}
          </a>
        ))}
      </div>
      {qr && (
        <div className="share-qr">
          <img src={qr} alt={`QR code for ${url}`} width="132" height="132" />
          <div><b>Scan to open</b><span>Point a phone camera at the code to open the website.</span></div>
        </div>
      )}
    </Modal>
  );
}
