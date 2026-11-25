// Resume templates. Every template is a set of "columns" of small blocks.
// Blocks are measured and then distributed onto pages, so the preview and the
// exported PDF break pages in exactly the same places.
import { lines, dateRange, isEmptyEntry } from '../lib/resume';
import { parseInline, isBulletLine, stripBullet } from '../lib/rich';

export const TEMPLATES = {
  modern: { name: 'Modern', blurb: 'Clean sans-serif with accent color', columns: ['main'], fs: 10 },
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

function Header({ p, withContact }) {
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
              <Link item={it} />
            </span>
          ))}
        </div>
      )}
    </header>
  );
}

const SectionTitle = ({ children }) => <h2 className="rs-section">{children}</h2>;

function EntryHead({ title, sub, date }) {
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

const Bullet = ({ children }) => (
  <ul className="rs-ul"><li>{children}</li></ul>
);

const join = (...parts) => parts.filter((x) => x && String(x).trim()).join(' · ');

// Build the list of blocks for one section.
function sectionBlocks(key, data, ctx) {
  const out = [];
  const push = (k, node, kwn = false) => out.push({ key: `${key}-${k}`, node, kwn });
  const title = (t) => push('title', <SectionTitle>{t}</SectionTitle>, true);

  if (key === 'summary') {
    // Paragraphs are separated by blank lines; lines starting with "- " are bullets.
    const parts = [];
    let para = [];
    const end = () => { if (para.length) { parts.push({ p: para.join(' ') }); para = []; } };
    (data.summary || '').split('\n').forEach((l) => {
      if (!l.trim()) end();
      else if (isBulletLine(l)) { end(); const t = stripBullet(l).trim(); if (t) parts.push({ b: t }); }
      else para.push(l.trim());
    });
    end();
    if (!parts.length) return out;
    title('Summary');
    parts.forEach((x, i) => push(`p${i}`, x.b ? <Bullet><Rich text={x.b} /></Bullet> : <p className="rs-p"><Rich text={x.p} /></p>));
  }

  if (key === 'experience') {
    const items = (data.experience || []).filter((e) => !isEmptyEntry(e));
    if (!items.length) return out;
    title('Experience');
    items.forEach((e) => {
      const b = lines(e.bullets);
      push(`${e.id}-h`, <EntryHead title={e.role || e.company} sub={join(e.role ? e.company : '', e.location)} date={dateRange(e.start, e.end, e.current)} />, b.length > 0);
      b.forEach((t, i) => push(`${e.id}-b${i}`, <Bullet><Rich text={t} /></Bullet>));
    });
  }

  if (key === 'education') {
    const items = (data.education || []).filter((e) => !isEmptyEntry(e));
    if (!items.length) return out;
    title('Education');
    items.forEach((e) => {
      const b = lines(e.details);
      push(`${e.id}-h`, <EntryHead title={e.degree || e.school} sub={join(e.degree ? e.school : '', e.location)} date={dateRange(e.start, e.end)} />, b.length > 0);
      b.forEach((t, i) => push(`${e.id}-b${i}`, <Bullet><Rich text={t} /></Bullet>));
    });
  }

  if (key === 'projects') {
    const items = (data.projects || []).filter((e) => !isEmptyEntry(e));
    if (!items.length) return out;
    title('Projects');
    items.forEach((e) => {
      const b = lines(e.bullets);
      const sub = e.link ? <a href={href(e.link)}>{e.link}</a> : null;
      push(`${e.id}-h`, <EntryHead title={e.name} sub={sub} date={dateRange(e.start, e.end)} />, b.length > 0);
      b.forEach((t, i) => push(`${e.id}-b${i}`, <Bullet><Rich text={t} /></Bullet>));
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
      const l = lines(c.content);
      if (!c.title && !l.length) return;
      if (c.title) push(`${c.id}-t`, <SectionTitle>{c.title}</SectionTitle>, l.length > 0);
      if (l.length === 1) push(`${c.id}-p`, <p className="rs-p"><Rich text={l[0]} /></p>);
      else l.forEach((t, i) => push(`${c.id}-b${i}`, <Bullet><Rich text={t} /></Bullet>));
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

// Returns { main: Block[], side?: Block[] }
export function buildColumns(resume) {
  const { data, template, sectionOrder, hidden = [] } = resume;
  const tpl = TEMPLATES[template] || TEMPLATES.modern;
  const order = (sectionOrder || []).filter((k) => !hidden.includes(k));
  const p = data.personal || {};

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
