// Resume templates. Every template is a set of "columns" of small blocks.
// Blocks are measured and then distributed onto pages, so the preview and the
// exported PDF break pages in exactly the same places.
import { dateRange, isEmptyEntry } from '../lib/resume';
import { parseInline, textBlocks, upgradeResume } from '../lib/rich';

export const TEMPLATES = {
  modern: { name: 'Modern', blurb: 'Clean sans-serif with accent color', columns: ['main'], fs: 10 },
  // Full-width header, then experience on the left and achievements / education / skills on the right.
  highlight: {
    name: 'Highlight', blurb: 'Bold headings, achievements column', columns: ['main', 'side'], fs: 9.6,
    top: true, side: ['custom', 'education', 'skills'], accent: '#e5372a',
    order: ['summary', 'custom', 'experience', 'education', 'skills', 'projects'],
  },
  classic: { name: 'Classic', blurb: 'Timeless serif, centered header', columns: ['main'], fs: 10.5 },
  compact: { name: 'Concise', blurb: 'Tight spacing — fits more on one page', columns: ['main'], fs: 9 },
  spacious: { name: 'Spacious', blurb: 'Airy layout, larger type', columns: ['main'], fs: 11 },
  sidebar: { name: 'Sidebar', blurb: 'Two columns with a tinted sidebar', columns: ['side', 'main'], fs: 9.6 },
  executive: { name: 'Executive', blurb: 'Bold color header band', columns: ['main'], fs: 10 },
  minimal: { name: 'Minimal', blurb: 'Light type, lots of white space', columns: ['main'], fs: 9.8 },
  timeline: { name: 'Timeline', blurb: 'Dates in a left-hand column', columns: ['main'], fs: 9.8 },
  elegant: { name: 'Elegant', blurb: 'Serif with centered, ruled headings', columns: ['main'], fs: 10 },
  bold: { name: 'Bold', blurb: 'Big name, solid section labels', columns: ['main'], fs: 10 },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES);

// Spacing presets: multiply page margins (pad) and gaps between sections/entries (gap).
export const SPACING = {
  compact: { label: 'Compact', pad: 0.6, gap: 0.6 },
  default: { label: 'Default', pad: 1, gap: 1 },
  spacious: { label: 'Spacious', pad: 1.3, gap: 1.4 },
};

// Font size limits (in points) for the +/- control.
export const FONT_MIN = 7.5;
export const FONT_MAX = 13;
export const FONT_STEP = 0.5;
export const baseFontSize = (template) => (TEMPLATES[template] || TEMPLATES.modern).fs;

// CSS variables shared by the preview, the measuring pass and the printed pages.
export function pageVars(resume) {
  const size = PAGE_SIZES[resume.pageSize] || PAGE_SIZES.A4;
  const sp = SPACING[resume.spacing] || SPACING.default;
  return {
    '--accent': resume.accent,
    '--page-w': size.w,
    '--page-h': size.h,
    '--fs-d': `${resume.fontDelta || 0}pt`,
    '--pad-m': sp.pad,
    '--gap-m': sp.gap,
  };
}

export const PAGE_SIZES = {
  A4: { label: 'A4', w: '210mm', h: '297mm', css: 'A4' },
  Letter: { label: 'US Letter', w: '8.5in', h: '11in', css: 'letter' },
};

const SIDEBAR_SECTIONS = ['skills', 'custom'];

const href = (v) => (/^(https?:|mailto:|tel:)/i.test(v) ? v : `https://${v}`);

function contactItems(p) {
  const items = [];
  if (p.email) items.push({ k: 'email', text: p.email, href: `mailto:${p.email}` });
  if (p.phone) items.push({ k: 'phone', text: p.phone, href: `tel:${p.phone.replace(/\s+/g, '')}` });
  if (p.location) items.push({ k: 'location', text: p.location });
  if (p.website) items.push({ k: 'website', text: p.website, href: href(p.website) });
  if (p.linkedin) items.push({ k: 'linkedin', text: p.linkedin, href: href(p.linkedin) });
  return items;
}

const Link = ({ item }) => (item.href ? <a href={item.href}>{item.text}</a> : <span>{item.text}</span>);

const CONTACT_ICONS = {
  phone: <path d="M5 4h3l2 5-2.5 1.5a11 11 0 005 5L14 13l5 2v3a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2" />,
  email: <><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-4 8" /></>,
  location: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  website: <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />,
};
CONTACT_ICONS.linkedin = CONTACT_ICONS.website;
const ContactIcon = ({ k }) => (
  <svg className="rs-ci" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{CONTACT_ICONS[k]}</svg>
);

function Header({ p, withContact, icons }) {
  const items = contactItems(p);
  return (
    <header className="rs-header">
      <h1 className="rs-name">{p.fullName || 'Your Name'}</h1>
      {p.headline && <div className="rs-headline">{p.headline}</div>}
      {withContact && items.length > 0 && (
        <div className="rs-contact">
          {items.map((it, i) => (
            <span key={it.k} className="rs-contact-item">
              {i > 0 && <span className="rs-sep" aria-hidden>•</span>}
              {icons && <ContactIcon k={it.k} />}
              <Link item={it} />
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

const SectionTitle = ({ children }) => <h2 className="rs-section">{children}</h2>;

function EntryHead({ title, sub, date, org, place, stacked }) {
  // "Stacked": title on its own line, then company (in the accent color) and dates.
  if (stacked) {
    return (
      <div className="rs-eh rs-eh-stacked">
        <div className="rs-eh-title">{title}</div>
        {(org || date || place) && (
          <div className="rs-eh-meta">
            {org && <span className="rs-eh-org">{org}</span>}
            {date && <span className="rs-eh-date">{date}</span>}
            {place && <span className="rs-eh-place">{place}</span>}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="rs-eh">
      <div className="rs-eh-row">
        <span className="rs-eh-title">{title}</span>
        {date && <span className="rs-eh-date">{date}</span>}
      </div>
      {sub && <div className="rs-eh-sub">{sub}</div>}
    </div>
  );
}

// Formatted text: **bold**, _italic_, ++underline++, [links](…).
function renderSegs(segs) {
  return segs.map((g, i) => {
    let n = g.text;
    if (g.i) n = <em>{n}</em>;
    if (g.b) n = <strong>{n}</strong>;
    if (g.u) n = <u>{n}</u>;
    if (g.href) n = <a href={href(g.href)}>{n}</a>;
    return <span key={i}>{n}</span>;
  });
}
const Rich = ({ text }) => renderSegs(parseInline(text));

// Split formatted text on commas, keeping formatting (for skill chips).
function splitSegs(text) {
  const chips = [[]];
  for (const g of parseInline(text)) {
    g.text.split(',').forEach((part, i) => {
      if (i > 0) chips.push([]);
      if (part) chips[chips.length - 1].push({ ...g, text: part });
    });
  }
  return chips
    .map((c) => {
      if (!c.length) return c;
      const first = { ...c[0], text: c[0].text.replace(/^\s+/, '') };
      const rest = c.slice(1);
      const all = [first, ...rest];
      const last = all[all.length - 1];
      all[all.length - 1] = { ...last, text: last.text.replace(/\s+$/, '') };
      return all.filter((x) => x.text);
    })
    .filter((c) => c.length);
}

// One line of a description: a paragraph, a bullet, or a numbered item (indented by level).
function TextBlock({ b }) {
  const indent = b.level ? { marginLeft: `${b.level * 11}pt` } : undefined;
  if (b.kind === 'ul') return <ul className="rs-ul" style={indent}><li className={b.level ? 'sub' : undefined}><Rich text={b.text} /></li></ul>;
  if (b.kind === 'ol') return <ol className="rs-ol" style={indent}><li><span className="rs-num">{b.level % 2 ? String.fromCharCode(96 + ((b.n - 1) % 26) + 1) : b.n}.</span><Rich text={b.text} /></li></ol>;
  return <p className="rs-tp" style={indent}><Rich text={b.text} /></p>;
}

const join = (...parts) => parts.filter((x) => x && String(x).trim()).join(' · ');

// Build the list of blocks for one section.
function sectionBlocks(key, data, ctx) {
  const out = [];
  const push = (k, node, kwn = false) => out.push({ key: `${key}-${k}`, node, kwn });
  const title = (t) => push('title', <SectionTitle>{t}</SectionTitle>, true);

  if (key === 'summary') {
    const bl = textBlocks(data.summary);
    if (!bl.length) return out;
    title('Summary');
    bl.forEach((b, i) => push(`p${i}`, <TextBlock b={b} />));
  }

  if (key === 'experience') {
    const items = (data.experience || []).filter((e) => !isEmptyEntry(e));
    if (!items.length) return out;
    title('Experience');
    items.forEach((e) => {
      const b = textBlocks(e.bullets);
      push(`${e.id}-h`, <EntryHead stacked={ctx.stacked} org={e.role ? e.company : ''} place={e.location} title={e.role || e.company} sub={join(e.role ? e.company : '', e.location)} date={dateRange(e.start, e.end, e.current)} />, b.length > 0);
      b.forEach((t, i) => push(`${e.id}-b${i}`, <TextBlock b={t} />));
    });
  }

  if (key === 'education') {
    const items = (data.education || []).filter((e) => !isEmptyEntry(e));
    if (!items.length) return out;
    title('Education');
    items.forEach((e) => {
      const b = textBlocks(e.details);
      push(`${e.id}-h`, <EntryHead stacked={ctx.stacked} org={e.degree ? e.school : ''} place={e.location} title={e.degree || e.school} sub={join(e.degree ? e.school : '', e.location)} date={dateRange(e.start, e.end)} />, b.length > 0);
      b.forEach((t, i) => push(`${e.id}-b${i}`, <TextBlock b={t} />));
    });
  }

  if (key === 'projects') {
    const items = (data.projects || []).filter((e) => !isEmptyEntry(e));
    if (!items.length) return out;
    title('Projects');
    items.forEach((e) => {
      const b = textBlocks(e.bullets);
      const sub = e.link ? <a href={href(e.link)}>{e.link}</a> : null;
      push(`${e.id}-h`, <EntryHead stacked={ctx.stacked} org={sub} title={e.name} sub={sub} date={dateRange(e.start, e.end)} />, b.length > 0);
      b.forEach((t, i) => push(`${e.id}-b${i}`, <TextBlock b={t} />));
    });
  }

  if (key === 'skills') {
    const items = (data.skills || []).filter((s) => (s.items || '').trim());
    if (!items.length) return out;
    title('Skills');
    items.forEach((s) => {
      if (ctx.chips) {
        const chips = splitSegs(s.items);
        push(s.id, (
          <div className="rs-skill">
            {s.label && <div className="rs-skill-label">{s.label}</div>}
            <div className="rs-chips">{chips.map((c, i) => <span key={i} className="rs-chip">{renderSegs(c)}</span>)}</div>
          </div>
        ));
      } else {
        push(s.id, (
          <div className="rs-skill">
            {s.label && <span className="rs-skill-label">{s.label}: </span>}
            <span><Rich text={s.items.replace(/\n+/g, ' ')} /></span>
          </div>
        ));
      }
    });
  }

  if (key === 'custom') {
    (data.custom || []).forEach((c) => {
      const l = textBlocks(c.content);
      if (!c.title && !l.length) return;
      if (c.title) push(`${c.id}-t`, <SectionTitle>{c.title}</SectionTitle>, l.length > 0);
      l.forEach((t, i) => push(`${c.id}-b${i}`, <div className="rs-custom"><TextBlock b={t} /></div>));
    });
  }

  return out;
}

function ContactBlock({ p }) {
  const items = contactItems(p);
  if (!items.length) return null;
  return (
    <div className="rs-contact-list">
      {items.map((it) => (
        <div key={it.k} className="rs-contact-row">
          <span className="rs-contact-k">{it.k === 'linkedin' ? 'LinkedIn' : it.k[0].toUpperCase() + it.k.slice(1)}</span>
          <Link item={it} />
        </div>
      ))}
    </div>
  );
}

// Example "Key achievements" that show off the Highlight template.
export const SAMPLE_ACHIEVEMENTS = {
  id: 'c0', title: 'Key achievements',
  content: '- **Faster onboarding** **+18% day-7 retention** after redesigning the first-run flow\n- **Design system** **120 components** adopted by 6 product teams\n- **Red Dot Award** Communication Design, 2021',
};
// Example content for a template (Highlight adds a Key achievements section).
export function templateSample(data, key) {
  const custom = data.custom || [];
  // Only for the built-in example (its Languages section has id "c1"), and only once.
  if (!TEMPLATES[key]?.top || !custom.some((c) => c.id === 'c1') || custom.some((c) => c.id === 'c0')) return data;
  return { ...data, custom: [SAMPLE_ACHIEVEMENTS, ...custom.filter((c) => c.title !== 'Awards')] };
}

// Returns { top?: Block[], main: Block[], side?: Block[] }
export function buildColumns(input) {
  const resume = upgradeResume(input);
  const { data, template, sectionOrder, hidden = [] } = resume;
  const tpl = TEMPLATES[template] || TEMPLATES.modern;
  const order = (sectionOrder || []).filter((k) => !hidden.includes(k));
  const p = data.personal || {};

  if (tpl.top) {
    const top = [{ key: 'header', node: <Header p={p} withContact icons />, kwn: false }];
    const main = [];
    const side = [];
    order.forEach((k) => {
      if (tpl.side.includes(k)) side.push(...sectionBlocks(k, data, { chips: true, stacked: true }));
      else main.push(...sectionBlocks(k, data, { stacked: true }));
    });
    return { top, main, side };
  }

  if (tpl.columns.length === 1) {
    const main = [{ key: 'header', node: <Header p={p} withContact />, kwn: false }];
    order.forEach((k) => main.push(...sectionBlocks(k, data, {})));
    return { main };
  }

  const main = [{ key: 'header', node: <Header p={p} withContact={false} />, kwn: false }];
  const side = [];
  const contact = contactItems(p);
  if (contact.length) {
    side.push({ key: 'contact-title', node: <SectionTitle>Contact</SectionTitle>, kwn: true });
    side.push({ key: 'contact', node: <ContactBlock p={p} />, kwn: false });
  }
  order.forEach((k) => {
    if (SIDEBAR_SECTIONS.includes(k)) side.push(...sectionBlocks(k, data, { chips: true }));
    else main.push(...sectionBlocks(k, data, {}));
  });
  return { main, side };
}
