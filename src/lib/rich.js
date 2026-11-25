// Light text formatting stored inside ordinary strings, so resumes stay simple text.
//   **bold**   _italic_   ++underline++   [link text](https://…)   "- " at the start of a line = bullet
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
    if (c === '\\' && i + 1 < s.length && /[\\*_+[\]()]/.test(s[i + 1])) { buf += s[i + 1]; i++; continue; }
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

const BULLET = /^\s*[-•*]\s+/;
export const isBulletLine = (l) => BULLET.test(l);
export const stripBullet = (l) => l.replace(BULLET, '');

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

// Stored text → HTML for the editor. In "lines" fields every line is a bullet already.
export function toEditorHtml(text, { lists = true } = {}) {
  const ls = (text || '').split('\n');
  let html = '';
  let inList = false;
  for (const l of ls) {
    if (lists && isBulletLine(l)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li><p>${inlineHtml(stripBullet(l))}</p></li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${inlineHtml(lists ? l : l.replace(/^\s*(?:[-•]\s*|\*\s+)/, ''))}</p>`;
    }
  }
  if (inList) html += '</ul>';
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

export function fromEditorJson(doc) {
  const lines = [];
  for (const node of doc.content || []) {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      for (const li of node.content || []) {
        for (const p of li.content || []) {
          if (p.type === 'paragraph') inlineText(p.content).split('\n').forEach((x) => lines.push(`- ${x}`));
        }
      }
    } else {
      inlineText(node.content).split('\n').forEach((x) => lines.push(x));
    }
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
