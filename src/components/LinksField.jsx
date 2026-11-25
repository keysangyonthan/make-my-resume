// "Links" in Personal details: short label shown on the resume + the address it opens.
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './ui';
import { LINK_SUGGESTIONS, guessLabel, linksOf, newLink } from '../lib/links';

export default function LinksField({ personal, onChange }) {
  const links = linksOf(personal);
  const listId = useId();
  const [focusId, setFocusId] = useState(null);
  const urlRefs = useRef({});

  useEffect(() => {
    if (focusId && urlRefs.current[focusId]) { urlRefs.current[focusId].focus(); setFocusId(null); }
  }, [focusId, links.length]);

  const save = (next) => onChange(next);
  const set = (i, patch) => save(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const add = (label = '') => { const l = newLink(label); save([...links, l]); setFocusId(l.id); };
  const remove = (i) => save(links.filter((_, j) => j !== i));
  const quick = LINK_SUGGESTIONS.filter((s) => !links.some((l) => (l.label || '').toLowerCase() === s.toLowerCase())).slice(0, 4);

  return (
    <div className="field full links-field">
      <label>Links <span className="opt">(optional)</span></label>
      {links.length > 0 && (
        <div className="links-head" aria-hidden><span>Shown as</span><span>Link</span></div>
      )}
      {links.map((l, i) => (
        <div key={l.id || i} className="link-row">
          <input
            type="text" className="link-label" list={listId} value={l.label || ''} placeholder="LinkedIn"
            aria-label="Text shown on resume" onChange={(e) => set(i, { label: e.target.value })}
          />
          <input
            ref={(el) => { urlRefs.current[l.id] = el; }}
            type="text" inputMode="url" className="link-url" value={l.url || ''} placeholder="linkedin.com/in/yourname"
            aria-label="Link address" onChange={(e) => set(i, { url: e.target.value })}
            onBlur={(e) => { if (!(l.label || '').trim() && e.target.value.trim()) set(i, { label: guessLabel(e.target.value) }); }}
          />
          <button type="button" className="icon-btn danger" title="Remove link" aria-label="Remove link" onClick={() => remove(i)}>{Icon.trash}</button>
        </div>
      ))}
      <datalist id={listId}>{LINK_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      <div className="links-add">
        <button type="button" className="link-chip main" onClick={() => add()}>{Icon.plus} Add link</button>
        {quick.map((s) => (
          <button key={s} type="button" className="link-chip" onClick={() => add(s)}>+ {s}</button>
        ))}
      </div>
      <div className="help">Your resume shows the short text (like <u>LinkedIn</u>) as a clickable link — no long addresses.</div>
    </div>
  );
}
