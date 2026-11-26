// A date box that opens a small month + year calendar. People can still type anything
// ("Summer 2021", "2019"); picking from the calendar fills in "Mar 2022" (or just the year).
import { useEffect, useRef, useState } from 'react';
import { Field } from './FormParts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NOW = new Date();

// "Mar 2022" / "March 2022" / "03/2022" / "2022" → { m: 2 | null, y: 2022 | null }
function parse(v) {
  const s = (v || '').trim();
  const y = s.match(/\b(19|20)\d{2}\b/);
  const year = y ? Number(y[0]) : null;
  let m = MONTHS.findIndex((mm) => new RegExp(`\\b${mm}`, 'i').test(s));
  if (m < 0) { const n = s.match(/^(\d{1,2})[/.-](19|20)\d{2}$/); m = n ? Number(n[1]) - 1 : -1; }
  return { m: m >= 0 && m < 12 ? m : null, y: year };
}

export default function DateField({ label, value, onChange, placeholder, optional, disabled, startYear }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('months'); // months | years
  const cur = parse(value);
  const [year, setYear] = useState(cur.y || startYear || NOW.getFullYear());
  const wrap = useRef(null);

  // Opening jumps to the year already in the box.
  useEffect(() => {
    if (!open) return;
    const p = parse(value);
    setYear(p.y || startYear || NOW.getFullYear());
    setView('months');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on a click elsewhere or Esc.
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pickMonth = (m) => { onChange(`${MONTHS[m]} ${year}`); setOpen(false); };
  const pickYearOnly = () => { onChange(String(year)); setOpen(false); };
  const decade = Math.floor(year / 12) * 12; // 12 years per page

  return (
    <Field label={label} optional={optional}>
      {(id) => (
        <div className="datefield" ref={wrap}>
          <input
            id={id} type="text" value={value || ''} placeholder={placeholder} disabled={disabled} autoComplete="off"
            onChange={(e) => onChange(e.target.value)} onFocus={() => !disabled && setOpen(true)} onClick={() => !disabled && setOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Tab') setOpen(false); if (e.key === 'ArrowDown') setOpen(true); }}
          />
          <button type="button" className="datefield-btn" tabIndex={-1} aria-label="Open calendar" disabled={disabled}
            onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen((o) => !o)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
          </button>
          {open && (
            <div className="cal" role="dialog" aria-label={`${label}: choose month and year`} onMouseDown={(e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }}>
              <div className="cal-head">
                <button type="button" className="cal-nav" aria-label={view === 'months' ? 'Previous year' : 'Earlier years'}
                  onClick={() => setYear((y) => y - (view === 'months' ? 1 : 12))}>‹</button>
                <button type="button" className="cal-title" onClick={() => setView((v) => (v === 'months' ? 'years' : 'months'))}
                  aria-label={view === 'months' ? 'Choose a year' : 'Back to months'}>
                  {view === 'months' ? year : `${decade} – ${decade + 11}`}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d={view === 'months' ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} /></svg>
                </button>
                <button type="button" className="cal-nav" aria-label={view === 'months' ? 'Next year' : 'Later years'}
                  onClick={() => setYear((y) => y + (view === 'months' ? 1 : 12))}>›</button>
              </div>
              {view === 'months' ? (
                <div className="cal-grid">
                  {MONTHS.map((m, i) => {
                    const on = cur.y === year && cur.m === i;
                    const now = NOW.getFullYear() === year && NOW.getMonth() === i;
                    return (
                      <button key={m} type="button" className={`cal-cell ${on ? 'on' : ''} ${now ? 'now' : ''}`} onClick={() => pickMonth(i)}>{m}</button>
                    );
                  })}
                </div>
              ) : (
                <div className="cal-grid">
                  {Array.from({ length: 12 }, (_, i) => decade + i).map((y) => (
                    <button key={y} type="button" className={`cal-cell ${cur.y === y ? 'on' : ''} ${NOW.getFullYear() === y ? 'now' : ''}`}
                      onClick={() => { setYear(y); setView('months'); }}>{y}</button>
                  ))}
                </div>
              )}
              <div className="cal-foot">
                <button type="button" className="link-btn" onClick={pickYearOnly}>Just {year}</button>
                {value && <button type="button" className="link-btn subtle" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>}
              </div>
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
