// Light text formatting stored inside ordinary strings, so resumes stay simple text.
//   **bold**   _italic_   ++underline++   [link text](https://…)
//   Lines: "- item" = bullet, "1. item" = numbered, two spaces in front per indent level.
//          "> text" = more text inside a list item, lined up with it (no bullet / number).
//   Every other line is a plain paragraph.
// Literal * _ [ ] \ and ++ typed by the person are saved with a backslash in front.

const ESC = /[\\*_[\]]/g;
export const escapeText = (s) => s.replace(ESC, (c) => `\\${c}`).replace(/\+\+/g, '\\+\\+');

const alnum = (c) => !!c && /[\p{L}\p{N}]/u.test(c);

// Find the closing marker for an opener at position `from` (just after the opener).
function findClose(s, from, mark, boundary) {
  for (let i = from; i < s.length; i++) {
    if (s[i] === '\\') { i++; continue; }
    if (s.startsWith(mark, i) && i > from && !/\s/.test(s[i - 1])) {
      if (mark === '**' && s[i + 2] === '*') continue; // let "***" close on the last pair
      if (boundary && alnum(s[i + mark.length])) continue;
      return i;
    }
  }
  return -1;
}

// Text → segments: [{ text, b, i, u, href }]
export function parseInline(s, marks = {}) {
  const out = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ text: buf, ...marks }); buf = ''; } };
  for (let i = 0; i < (s || '').length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && /[\\*_+[\]().\-•>]/.test(s[i + 1])) { buf += s[i + 1]; i++; continue; }
    const tryMark = (mark, key, boundary) => {
      if (!s.startsWith(mark, i) || marks[key]) return false;
      if (boundary && alnum(s[i - 1])) return false;
      if (!s[i + mark.length] || /\s/.test(s[i + mark.length])) return false;
      const end = findClose(s, i + mark.length, mark, boundary);
      if (end < 0) return false;
      flush();
      out.push(...parseInline(s.slice(i + mark.length, end), { ...marks, [key]: true }));
      i = end + mark.length - 1;
      return true;
    };
    if (tryMark('**', 'b', false) || tryMark('++', 'u', true) || tryMark('_', 'i', true)) continue;
    if (c === '[' && !marks.href) {
      const m = /^\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)/.exec(s.slice(i));
      if (m) {
        flush();
        out.push(...parseInline(m[1], { ...marks, href: m[2] }));
        i += m[0].length - 1;
        continue;
      }
    }
    buf += c;
  }
  flush();
  return out;
}

export const plainText = (s) => parseInline(s).map((x) => x.text).join('');

// ---- lines & lists ----
const LIST_LINE = /^(\s*)(?:([-•*])|(\d+)[.)])\s+(.*)$/;
const CONT_LINE = /^(\s*)>\s?(.*)$/;
const levelOf = (sp) => Math.min(4, Math.floor(sp.replace(/\t/g, '  ').length / 2));
// → { kind: 'p' | 'ul' | 'ol' | 'cont', level, text }
export function parseLine(l) {
  const c = CONT_LINE.exec(l);
  if (c) return { kind: 'cont', level: levelOf(c[1]), text: c[2].trim() };
  const m = LIST_LINE.exec(l);
  if (!m) return { kind: 'p', level: 0, text: l.trim() ? l.trimEnd() : '' };
  return { kind: m[2] ? 'ul' : 'ol', level: levelOf(m[1]), text: m[4].trim() };
}
export const isBulletLine = (l) => LIST_LINE.test(l);
export const stripBullet = (l) => parseLine(l).text;

// Text → blocks for the resume, with numbers worked out: { kind, level, text, n }.
// Empty lines between text become { kind: 'gap' } so blank lines show as space.
export function textBlocks(text) {
  const out = [];
  const counters = [];
  let prev = null;
  let gaps = 0;
  const kindAt = []; // list kind at each level, for lining up "more text" lines
  for (const raw of (text || '').split('\n')) {
    if (!raw.trim()) { prev = null; counters.length = 0; if (out.length) gaps += 1; continue; }
    for (; gaps > 0; gaps -= 1) out.push({ kind: 'gap', level: 0, text: '' });
    const b = parseLine(raw);
    if (!b.text) continue;
    if (b.kind === 'p') { counters.length = 0; kindAt.length = 0; prev = b; out.push(b); continue; }
    if (b.kind === 'cont') {
      if (!kindAt.length) { out.push({ ...b, kind: 'p', level: 0 }); continue; } // not under a list
      b.level = Math.min(b.level, kindAt.length - 1);
      b.listKind = kindAt[b.level];
      out.push(b);
      continue;
    }
    kindAt.length = b.level;
    kindAt[b.level] = b.kind;
    counters.length = Math.min(counters.length, b.level + 1);
    if (b.kind === 'ol') {
      const continues = prev && prev.kind !== 'p' && (prev.level > b.level || (prev.level === b.level && prev.kind === 'ol'));
      counters[b.level] = continues && counters[b.level] ? counters[b.level] + 1 : 1;
      b.n = counters[b.level];
    } else counters[b.level] = 0;
    prev = b;
    out.push(b);
  }
  return out;
}

// Resumes made before lists were optional: every description line was a bullet.
const asBullets = (t) => (t || '').split('\n').map((l) => l.replace(/^\s*(?:[-•]\s*|\*\s+)/, '').trim()).filter(Boolean).map((l) => `- ${l}`).join('\n');
export const FORMAT_VERSION = 2;
export function upgradeData(data) {
  if (!data) return data;
  const map = (arr, key) => (arr || []).map((x) => ({ ...x, [key]: asBullets(x[key]) }));
  return {
    ...data,
    experience: map(data.experience, 'bullets'),
    education: map(data.education, 'details'),
    projects: map(data.projects, 'bullets'),
    custom: (data.custom || []).map((c) => {
      const n = (c.content || '').split('\n').filter((l) => l.trim()).length;
      return n > 1 ? { ...c, content: asBullets(c.content) } : c;
    }),
  };
}
export const upgradeResume = (r) => (!r || r.fmt >= FORMAT_VERSION ? r : { ...r, fmt: FORMAT_VERSION, data: upgradeData(r.data) });

const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineHtml(s) {
  return parseInline(s).map((g) => {
    let h = escHtml(g.text);
    if (g.i) h = `<em>${h}</em>`;
    if (g.b) h = `<strong>${h}</strong>`;
    if (g.u) h = `<u>${h}</u>`;
    if (g.href) h = `<a href="${escHtml(g.href)}">${h}</a>`;
    return h;
  }).join('');
}

// Stored text → HTML for the editor (nested bullet / numbered lists).
export function toEditorHtml(text, { lists = true } = {}) {
  let html = '';
  const stack = []; // open list tags, one per level
  const closeTo = (n) => { while (stack.length > n) html += `</li></${stack.pop()}>`; };
  for (const raw of (text || '').split('\n')) {
    const b = lists ? parseLine(raw) : { kind: 'p', level: 0, text: raw };
    if (b.kind === 'p') { closeTo(0); html += `<p>${inlineHtml(b.text)}</p>`; continue; }
    if (b.kind === 'cont') {
      // more text inside the open list item at that level
      if (stack.length) closeTo(Math.min(b.level, stack.length - 1) + 1);
      html += `<p>${inlineHtml(b.text)}</p>`;
      continue;
    }
    const lvl = Math.min(b.level, stack.length);
    closeTo(lvl + 1);
    if (stack.length === lvl + 1) {
      if (stack[lvl] === b.kind) html += '</li><li>';
      else { closeTo(lvl); html += `<${b.kind}><li>`; stack.push(b.kind); }
    } else { html += `<${b.kind}><li>`; stack.push(b.kind); }
    html += `<p>${inlineHtml(b.text)}</p>`;
  }
  closeTo(0);
  return html || '<p></p>';
}

// Editor document (ProseMirror JSON) → stored text.
function inlineText(nodes = []) {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'hardBreak') { out += '\n'; continue; }
    if (n.type !== 'text') continue;
    const marks = n.marks || [];
    const has = (t) => marks.find((m) => m.type === t);
    const raw = n.text;
    const lead = raw.match(/^\s*/)[0];
    const trail = raw.slice(lead.length).match(/\s*$/)[0];
    const core = raw.slice(lead.length, raw.length - trail.length);
    if (!core) { out += raw; continue; }
    let t = escapeText(core);
    if (has('italic')) t = `_${t}_`;
    if (has('bold')) t = `**${t}**`;
    if (has('underline')) t = `++${t}++`;
    const link = has('link');
    if (link?.attrs?.href) t = `[${t}](${String(link.attrs.href).replace(/\)/g, '%29').replace(/\s/g, '%20')})`;
    out += lead + t + trail;
  }
  return out;
}

// A plain line that happens to start like a list item gets a backslash so it stays plain.
const keepPlain = (l) => l.replace(/^(\s*)(\d+)([.)]\s)/, '$1$2\\$3').replace(/^(\s*)([-•])(\s)/, '$1\\$2$3').replace(/^(\s*)>/, '$1\\>');

export function fromEditorJson(doc) {
  const lines = [];
  const walkList = (list, level) => {
    let n = list.attrs?.start || 1;
    for (const li of list.content || []) {
      let first = true;
      for (const child of li.content || []) {
        if (child.type === 'bulletList' || child.type === 'orderedList') { walkList(child, level + 1); continue; }
        const text = inlineText(child.content).split('\n').join(' ');
        const pad = '  '.repeat(level);
        if (first) lines.push(`${pad}${list.type === 'orderedList' ? `${n++}.` : '-'} ${text}`);
        else lines.push(text ? `${pad}> ${text}` : `${pad}>`); // more text in the same item
        first = false;
      }
    }
  };
  for (const node of doc.content || []) {
    if (node.type === 'bulletList' || node.type === 'orderedList') walkList(node, 0);
    else inlineText(node.content).split('\n').forEach((x) => lines.push(keepPlain(x)));
  }
  while (lines.length && /^\s*>?$/.test(lines[lines.length - 1])) lines.pop();
  return lines.join('\n');
}
