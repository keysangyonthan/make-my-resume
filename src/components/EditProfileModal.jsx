import { useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import Modal from './Modal';

// Shrinks and center-crops an image file to a small square JPEG (data URL).
function resizeImage(file, size = 192) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file isn’t an image we can read.')); };
    img.src = url;
  });
}

export default function EditProfileModal({ onClose }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user.name || '');
  // undefined = keep Google photo, '' = no photo, 'data:…' = uploaded
  const [photo, setPhoto] = useState(user.profile?.photo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const shown = photo !== undefined ? photo : user.googlePhoto;
  const initial = (name || user.email || 'U').trim()[0]?.toUpperCase() || 'U';

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image (JPG, PNG, HEIC…).');
    if (file.size > 15 * 1024 * 1024) return setError('That image is too large. Please pick one under 15 MB.');
    setError('');
    try { setPhoto(await resizeImage(file)); } catch (err) { setError(err.message); }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const profile = { name: name.trim() };
      if (photo !== undefined) profile.photo = photo;
      await updateProfile(profile);
      onClose();
    } catch (err) {
      setError(err?.code === 'permission-denied'
        ? 'Couldn’t save — the database rules need updating. (Owner: publish the new firestore.rules.)'
        : 'Couldn’t save your profile. Please try again.');
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Edit profile"
      subtitle="Your name and photo inside the app. New resumes start with this name."
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </>
      )}
    >
      <div className="profile-photo">
        <div className="avatar xl">{shown ? <img src={shown} alt="" referrerPolicy="no-referrer" /> : initial}</div>
        <div className="profile-photo-actions">
          <button className="btn btn-white btn-sm" onClick={() => fileRef.current?.click()}>Upload photo</button>
          {user.googlePhoto && photo !== undefined && (
            <button className="link-btn" onClick={() => setPhoto(undefined)}>Use my Google photo</button>
          )}
          {shown && <button className="link-btn danger" onClick={() => setPhoto('')}>Remove photo</button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="profile-name">Name</label>
        <input id="profile-name" type="text" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={user.googleName || 'Your name'} />
        {user.googleName && name.trim() !== user.googleName && (
          <div className="help">Google name: {user.googleName} · <button className="link-btn inline" onClick={() => setName(user.googleName)}>use it</button></div>
        )}
      </div>

      {user.email && (
        <div className="field" style={{ marginTop: 14 }}>
          <label>Email</label>
          <div className="readonly">{user.email} <span>Signed in with Google</span></div>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
