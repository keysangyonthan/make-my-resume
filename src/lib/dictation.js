// Speak to type, using the browser's built-in speech recognition (free, no account).
// Chrome / Edge / Safari support it; newer Chrome can run it on the device itself.
import { useCallback, useEffect, useRef, useState } from 'react';

const Rec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const dictationSupported = !!Rec;

const ERRORS = {
  'not-allowed': 'Allow microphone access in your browser to use dictation.',
  'service-not-allowed': 'Dictation is turned off in this browser.',
  'audio-capture': 'No microphone found.',
  network: 'Dictation needs an internet connection in this browser.',
  'language-not-supported': 'Dictation doesn’t support your language yet.',
};

// A few spoken commands: "comma", "full stop", "question mark", "new line".
export function spokenToText(t) {
  return t
    .replace(/\s*\b(new line|next line|new paragraph)\b\s*/gi, '\n')
    .replace(/\s*\bcomma\b/gi, ',')
    .replace(/\s*\bfull stop\b/gi, '.')
    .replace(/\s*\bquestion mark\b/gi, '?')
    .replace(/\s*\bexclamation (mark|point)\b/gi, '!')
    .replace(/\s*\bcolon\b/gi, ':')
    .replace(/[ \t]+\n/g, '\n');
}

// Fit new words onto what's already typed: add a space, capitalise a new sentence.
export function joinSpoken(before, words) {
  let w = words.replace(/^\s+/, '');
  if (!w) return '';
  const atStart = !before.trim() || /[.!?]\s*$/.test(before) || /\n\s*$/.test(before);
  if (atStart) w = w[0].toUpperCase() + w.slice(1);
  const needsSpace = before && !/\s$/.test(before) && !/^[,.!?:;\n]/.test(w);
  return (needsSpace ? ' ' : '') + w;
}

export function useDictation(onText) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const rec = useRef(null);
  const want = useRef(false);
  const idle = useRef(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => {
    want.current = false;
    clearTimeout(idle.current);
    try { rec.current?.stop(); } catch { /* already stopped */ }
    setListening(false);
    setInterim('');
  }, []);

  // Stop by itself after a while of silence, so the microphone isn't left on.
  const bump = useCallback(() => {
    clearTimeout(idle.current);
    idle.current = setTimeout(() => stop(), 20000);
  }, [stop]);

  const start = useCallback(async () => {
    if (!Rec || want.current) return;
    setError('');
    const r = new Rec();
    r.lang = navigator.language || 'en-US';
    r.continuous = true;
    r.interimResults = true;
    // Prefer on-device recognition where the browser offers it.
    try {
      if ('processLocally' in r && typeof Rec.available === 'function') {
        const a = await Rec.available({ langs: [r.lang], processLocally: true });
        if (a === 'available') r.processLocally = true;
      }
    } catch { /* fall back to the browser's default */ }
    r.onstart = () => { setListening(true); bump(); };
    r.onresult = (e) => {
      let fin = '';
      let mid = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else mid += res[0].transcript;
      }
      setInterim(mid);
      if (fin.trim()) onTextRef.current(spokenToText(fin.trim()));
      bump();
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      want.current = false;
      setError(ERRORS[e.error] || 'Dictation stopped. Please try again.');
    };
    // Browsers end a session after a pause; carry on until the person stops.
    r.onend = () => {
      if (want.current) { try { r.start(); return; } catch { /* fall through */ } }
      setListening(false);
      setInterim('');
    };
    rec.current = r;
    want.current = true;
    try { r.start(); } catch { want.current = false; setError('Couldn’t start dictation. Please try again.'); }
  }, [bump]);

  useEffect(() => () => { want.current = false; clearTimeout(idle.current); try { rec.current?.abort(); } catch { /* ignore */ } }, []);

  return { listening, interim, error, start, stop, clearError: () => setError('') };
}
