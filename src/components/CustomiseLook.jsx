import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { THEMES } from '../lib/resume';
import {
  FONT_MAX, FONT_MIN, FONT_STEP, PAGE_SIZES, SPACING, TEMPLATES, TEMPLATE_KEYS, baseFontSize,
} from '../templates';
import ResumePages from './ResumePages';
import { Icon } from './ui';

const UPFRONT = 5; // styles shown inline; the rest live in the "More styles" popup
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
const fmt = (n) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

// Lines drawn in each spacing thumbnail: h = heading bar, l = text line.
const SPACING_SKETCH = {
  compact: 'hlllhllllhlllhl',
  default: 'hlllhll',
  spacious: 'hlhl',
};

// Live thumbnail that scales itself to the width of its container.
function StyleThumb({ resume, template }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: '100%' }}>
      {w > 0 && <ResumePages resume={{ ...resume, template }} width={w} maxPages={1} gap={0} />}
    </div>
  );
}

function StyleGallery({ resume, onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="All resume styles">
        <div className="modal-head">
          <div>
            <h2>All resume styles</h2>
            <p>Previewed with your details. Click a style to use it.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="gallery">
          {TEMPLATE_KEYS.map((k) => (
            <button key={k} type="button" className={`gallery-item ${resume.template === k ? 'on' : ''}`} onClick={() => onPick(k)}>
              <div className="gallery-thumb"><StyleThumb resume={resume} template={k} /></div>
              <div className="gallery-name">{TEMPLATES[k].name}{resume.template === k && <span className="tick">✓</span>}</div>
              <div className="gallery-desc">{TEMPLATES[k].blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function CustomiseLook({ resume, preview, setMeta, pageCount, open, setOpen }) {
  const [gallery, setGallery] = useState(false);
  const [hex, setHex] = useState(resume.accent);
  useEffect(() => setHex(resume.accent), [resume.accent]);

  // Styles shown inline: the first five, keeping the selected one visible.
  let shown = TEMPLATE_KEYS.slice(0, UPFRONT);
  if (!shown.includes(resume.template)) shown = [...shown.slice(0, UPFRONT - 1), resume.template];

  const presetColor = THEMES.find((t) => t.color.toLowerCase() === (resume.accent || '').toLowerCase());
  const onHex = (v) => {
    const val = v.startsWith('#') ? v : `#${v}`;
    setHex(val);
    if (isHex(val)) setMeta({ accent: val.toLowerCase() });
  };

  const base = baseFontSize(resume.template);
  const delta = resume.fontDelta || 0;
  const size = base + delta;
  const spacing = SPACING[resume.spacing] ? resume.spacing : 'default';
  const bump = (d) => {
    const next = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round((size + d) / FONT_STEP) * FONT_STEP));
    setMeta({ fontDelta: Math.round((next - base) * 100) / 100 });
  };

  const tips = [
    size - FONT_STEP >= FONT_MIN && 'lower the font size',
    spacing !== 'compact' && 'choose Compact spacing',
    resume.template !== 'compact' && 'try the Concise style',
  ].filter(Boolean);
  const tipText = tips.length ? tips.reduce((acc, t, i) => (i === 0 ? t : `${acc}${i === tips.length - 1 ? ' or ' : ', '}${t}`), '') : 'shorten some sections';

  return (
    <section className={`fcard customise ${open ? 'open' : ''}`} id="customise-look">
      <button type="button" className="customise-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="customise-ic" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="1.5" /><circle cx="17.5" cy="10.5" r="1.5" /><circle cx="8.5" cy="7.5" r="1.5" /><circle cx="6.5" cy="12.5" r="1.5" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.75 1.5-1.66 0-.43-.17-.82-.44-1.12-.27-.3-.43-.69-.43-1.12 0-.92.75-1.66 1.66-1.66H16c3.31 0 6-2.69 6-6C22 6.04 17.5 2 12 2z" /></svg>
        </span>
        <span className="customise-text">
          <b>Customise look</b>
          <span className="customise-sum">
            {TEMPLATES[resume.template]?.name}
            <i className="sum-dot" style={{ background: resume.accent }} />
            {presetColor ? presetColor.name : 'Custom'} · {fmt(size)} pt · {SPACING[spacing].label} spacing
          </span>
        </span>
        <span className="chev">{Icon.down}</span>
      </button>

      {open && (
        <div className="customise-body">
          {/* Resume style */}
          <div className="cl-group">
            <div className="cl-label">Resume style</div>
            <div className="style-row">
              {shown.map((k) => (
                <button key={k} type="button" className={`style-opt ${resume.template === k ? 'on' : ''}`} onClick={() => setMeta({ template: k })}>
                  <div className="style-thumb"><StyleThumb resume={preview} template={k} /></div>
                  <div className="style-name">{TEMPLATES[k].name}</div>
                </button>
              ))}
              <button type="button" className="style-opt more" onClick={() => setGallery(true)}>
                <div className="style-thumb more-thumb">
                  <span className="more-grid" aria-hidden><i /><i /><i /><i /></span>
                  <span className="more-count">+{TEMPLATE_KEYS.length - UPFRONT}</span>
                </div>
                <div className="style-name">More styles</div>
              </button>
            </div>
          </div>

          {/* Color */}
          <div className="cl-group">
            <div className="cl-label">Color</div>
            <div className="color-row">
              {THEMES.map((t) => {
                const on = t === presetColor;
                return (
                  <button key={t.color} type="button" className={`color-opt ${on ? 'on' : ''}`} style={{ '--c': t.color }}
                    onClick={() => setMeta({ accent: t.color })} aria-pressed={on} title={t.name}>
                    <span className="color-dot" />
                    <span className="color-name">{t.name}</span>
                  </button>
                );
              })}
              <div className={`color-opt custom ${!presetColor ? 'on' : ''}`} style={{ '--c': resume.accent }}>
                <label className="color-dot rainbow" title="Pick any color">
                  <input type="color" value={isHex(resume.accent) ? resume.accent : '#4f46e5'} onChange={(e) => setMeta({ accent: e.target.value })} />
                  {!presetColor && <span className="custom-fill" />}
                </label>
                <input className="hex-input" value={hex} onChange={(e) => onHex(e.target.value.trim())} maxLength={7} spellCheck={false} aria-label="Custom color hex code" />
              </div>
            </div>
          </div>

          {/* Font size + page size */}
          <div className="cl-group cl-inline">
            <div>
              <div className="cl-label">Font size</div>
              <div className="stepper" role="group" aria-label="Font size">
                <button type="button" onClick={() => bump(-FONT_STEP)} disabled={size - FONT_STEP < FONT_MIN - 0.01} aria-label="Decrease font size">−</button>
                <output aria-live="polite">{fmt(size)} pt</output>
                <button type="button" onClick={() => bump(FONT_STEP)} disabled={size + FONT_STEP > FONT_MAX + 0.01} aria-label="Increase font size">+</button>
              </div>
              {delta !== 0 && <button type="button" className="link-btn" style={{ marginTop: 6 }} onClick={() => setMeta({ fontDelta: 0 })}>Reset to {fmt(base)} pt</button>}
            </div>
            <div>
              <div className="cl-label">Page size</div>
              <div className="seg">
                {Object.entries(PAGE_SIZES).map(([k, v]) => (
                  <button key={k} type="button" className={resume.pageSize === k ? 'on' : ''} onClick={() => setMeta({ pageSize: k })}>{v.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Spacing */}
          <div className="cl-group">
            <div className="cl-label">Spacing</div>
            <div className="spacing-opts" role="radiogroup" aria-label="Spacing">
              {Object.entries(SPACING).map(([k, v]) => (
                <button key={k} type="button" role="radio" aria-checked={spacing === k}
                  className={`spacing-opt sp-${k} ${spacing === k ? 'on' : ''}`} onClick={() => setMeta({ spacing: k })}>
                  <span className="sp-mini">
                    {SPACING_SKETCH[k].split('').map((c, i) => <i key={i} className={c === 'h' ? 'h' : ''} />)}
                  </span>
                  <span className="sp-name">{v.label}</span>
                  <span className="sp-desc">{{ compact: 'Fits the most', default: 'Balanced', spacious: 'Airy, easy to read' }[k]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`fit-note ${pageCount === 1 ? 'ok' : ''}`}>
            {pageCount === 1 ? '✓ Fits on 1 page' : `Your resume is ${pageCount} pages. To fit it on one, ${tipText}.`}
          </div>
        </div>
      )}

      {gallery && (
        <StyleGallery resume={preview} onClose={() => setGallery(false)}
          onPick={(k) => { setMeta({ template: k }); setGallery(false); }} />
      )}
    </section>
  );
}
