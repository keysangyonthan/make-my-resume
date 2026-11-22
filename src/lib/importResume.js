// Turns an uploaded resume file (PDF, Word .docx or plain text) into simple,
// editable HTML: headings, paragraphs, bullet lists, bold/italic, tables.
// Heavy libraries are loaded only when someone actually uploads a file.

const MAX_FILE_MB = 15;
const MAX_IMAGE_BYTES = 450 * 1024; // keep documents well under the database's 1 MB limit

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function titleFromFile(name) {
  return (name || 'My resume').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'My resume';
}

export async function importResumeFile(file) {
  if (!file) throw new Error('No file selected.');
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`That file is larger than ${MAX_FILE_MB} MB. Please choose a smaller one.`);
  const name = file.name.toLowerCase();
  const warnings = [];
  let html;

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    html = await pdfToHtml(await file.arrayBuffer(), warnings);
  } else if (name.endsWith('.docx') || file.type.includes('officedocument.wordprocessingml')) {
    html = await docxToHtml(await file.arrayBuffer(), warnings);
  } else if (name.endsWith('.doc')) {
    throw new Error('Old Word files (.doc) aren’t supported. In Word, choose File → Save As → .docx, then upload that.');
  } else if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
    html = textToHtml(await file.text());
  } else {
    throw new Error('Please upload a PDF, a Word document (.docx) or a text file.');
  }

  html = limitImages(html, warnings);
  const plain = html.replace(/<[^>]+>/g, '').trim();
  if (!plain) {
    throw new Error('We couldn’t find any text in that file. If it’s a scanned image, please upload the original Word or PDF instead.');
  }
  return { html, title: titleFromFile(file.name), warnings };
}

// ───────── Word (.docx) ─────────
async function docxToHtml(arrayBuffer, warnings) {
  const mod = await import('mammoth/mammoth.browser.js');
  const mammoth = mod.default || mod;
  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => p:fresh",
        "p[style-name='Heading 1'] => h2:fresh",
        "p[style-name='Heading 2'] => h3:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    },
  );
  if (result.messages?.some((m) => m.type === 'warning')) {
    warnings.push('Some Word formatting (like text boxes or special fonts) was simplified.');
  }
  return result.value;
}

// ───────── Plain text ─────────
function textToHtml(text) {
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return '';
    if (lines.every((l) => /^[-*•]\s+/.test(l))) {
      return `<ul>${lines.map((l) => `<li><p>${esc(l.replace(/^[-*•]\s+/, ''))}</p></li>`).join('')}</ul>`;
    }
    if (lines.length === 1 && /^#{1,3}\s/.test(lines[0])) {
      const level = Math.min(3, lines[0].match(/^#+/)[0].length);
      return `<h${level}>${esc(lines[0].replace(/^#+\s*/, ''))}</h${level}>`;
    }
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('');
}

// ───────── PDF ─────────
// Bullet characters, including the private-use symbols Word uses for its bullet fonts (Symbol/Wingdings).
const BULLET = /^\s*([•●▪◦‣∙·■□➢➤►▶✓✔\-–—*\uF000-\uF0FF])\s*/;

// Reads every text piece of a PDF with its position, size and weight. Shared with the LinkedIn reader.
export async function readPdfPages(arrayBuffer) {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), isEvalSupported: false, fontExtraProperties: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    await page.getOperatorList(); // makes font names available
    const content = await page.getTextContent();
    const { height: pageH, width: pageW } = page.getViewport({ scale: 1 });
    const items = content.items
      .filter((it) => typeof it.str === 'string' && it.str.length)
      .map((it) => {
        let fontName = '';
        try { fontName = page.commonObjs.get(it.fontName)?.name || ''; } catch { /* not loaded */ }
        const family = content.styles?.[it.fontName]?.fontFamily || '';
        const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
        return {
          str: it.str,
          x: it.transform[4],
          y: pageH - it.transform[5],
          w: it.width,
          size,
          bold: /bold|black|heavy|semibold|demi/i.test(fontName + family),
          italic: /italic|oblique/i.test(fontName + family),
        };
      });
    pages.push({ number: p, items, pageW, pageH });
  }
  return pages;
}

async function pdfToHtml(arrayBuffer, warnings) {
  const pdfPages = await readPdfPages(arrayBuffer);
  const allLines = [];
  let twoColumnHint = false;

  for (const { number: p, items, pageW } of pdfPages) {
    // Two-column layouts: find a vertical gutter and read each column separately.
    let groups = [items];
    const split = findColumnSplit(items, pageW);
    if (split) {
      twoColumnHint = true;
      const left = items.filter((i) => i.x < split);
      const right = items.filter((i) => i.x >= split);
      const biggest = (arr) => Math.max(0, ...arr.map((i) => i.size));
      groups = biggest(right) > biggest(left) ? [right, left] : [left, right];
    }

    const pageLines = [];
    groups.forEach((g) => {
      const lines = groupLines(g).map((l) => buildLine(l));
      if (!lines.length) return;
      const rightEdge = Math.max(...lines.map((l) => l.right));
      // The column's text margin = the left-most x used by a fair share of lines. Lines slightly to the
      // right of it are usually bullets whose dots were drawn as shapes rather than text.
      const xs = {};
      lines.forEach((l) => { const k = Math.round(l.x / 2) * 2; xs[k] = (xs[k] || 0) + 1; });
      const common = Object.entries(xs).filter(([, n]) => n >= Math.max(2, lines.length * 0.15)).map(([x]) => Number(x));
      const leftEdge = common.length ? Math.min(...common) : Math.min(...lines.map((l) => l.x));
      lines.forEach((l) => { l.rightEdge = rightEdge; l.page = p; l.indented = l.x > leftEdge + 6 && l.x < leftEdge + 40; });
      pageLines.push(...lines);
    });
    allLines.push(...pageLines.filter((l) => l.text.trim()));
  }

  if (twoColumnHint) warnings.push('Your file has two columns, so we placed them one after the other — you may want to move a few sections around.');
  return linesToHtml(allLines);
}

// Group text pieces into lines (same baseline), top to bottom.
export function groupLines(items) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  sorted.forEach((it) => {
    const line = lines.find((l) => Math.abs(l.y - it.y) < Math.max(2, it.size * 0.45));
    if (line) line.items.push(it); else lines.push({ y: it.y, items: [it] });
  });
  return lines.sort((a, b) => a.y - b.y);
}

// Looks for an x position (between 20% and 65% of the page width) where many lines
// have a large empty gap — the space between two columns.
export function findColumnSplit(items, pageW) {
  const lines = groupLines(items.filter((i) => i.str.trim()));
  if (lines.length < 12) return null;
  const starts = [];
  lines.forEach((l) => {
    const its = l.items.filter((i) => i.str.trim()).sort((a, b) => a.x - b.x);
    for (let k = 1; k < its.length; k += 1) {
      const gap = its[k].x - (its[k - 1].x + its[k - 1].w);
      if (gap > its[k].size * 2.5 && its[k].x > pageW * 0.2 && its[k].x < pageW * 0.65) starts.push(its[k].x);
    }
  });
  if (starts.length < Math.max(5, lines.length * 0.1)) return null;
  starts.sort((a, b) => a - b);
  const median = starts[Math.floor(starts.length / 2)];
  const near = starts.filter((x) => Math.abs(x - median) < 12).length;
  if (near < starts.length * 0.6) return null;
  // Put the split just left of the right column, but not through any text.
  return Math.min(...starts.filter((x) => Math.abs(x - median) < 12)) - 2;
}

export function buildLine(line) {
  // Whitespace-only pieces often stretch across big gaps (e.g. to a right-aligned date); ignore them.
  const visible = line.items.filter((i) => i.str.trim());
  const items = (visible.length ? visible : line.items).sort((a, b) => a.x - b.x);
  const runs = [];
  let prev = null;
  let hasBigGap = false;
  items.forEach((it) => {
    let text = it.str;
    if (prev) {
      const gap = it.x - (prev.x + prev.w);
      if (gap > it.size * 2.5) { text = `  ·  ${text.trimStart()}`; hasBigGap = true; }
      else if (gap > it.size * 0.18 && !/\s$/.test(prev.str) && !/^\s/.test(text)) text = ` ${text}`;
    }
    const last = runs[runs.length - 1];
    if (last && last.bold === it.bold && last.italic === it.italic) last.text += text;
    else runs.push({ text, bold: it.bold, italic: it.italic });
    prev = it;
  });
  const text = runs.map((r) => r.text).join('');
  const letters = text.replace(/[^A-Za-z]/g, '');
  const boldChars = runs.filter((r) => r.bold).reduce((n, r) => n + r.text.trim().length, 0);
  return {
    y: line.y,
    x: items[0].x,
    right: Math.max(...items.map((i) => i.x + i.w)),
    size: Math.max(...items.map((i) => i.size)),
    runs,
    text,
    hasBigGap,
    allBold: boldChars >= text.replace(/\s/g, '').length * 0.9,
    upper: letters.length > 2 && letters === letters.toUpperCase(),
  };
}

function runsToHtml(runs, stripBullet = false) {
  let first = true;
  return runs.map((r) => {
    let t = r.text;
    if (first && stripBullet) t = t.replace(BULLET, '');
    if (first) t = t.trimStart();
    first = false;
    let h = esc(t);
    if (!h) return '';
    if (r.bold) h = `<strong>${h}</strong>`;
    if (r.italic) h = `<em>${h}</em>`;
    return h;
  }).join('').trim();
}

function linesToHtml(lines) {
  // The most common text size is the "body" size.
  const counts = {};
  lines.forEach((l) => { const k = Math.round(l.size * 2) / 2; counts[k] = (counts[k] || 0) + l.text.length; });
  const body = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 10);

  const blocks = [];
  let prev = null;
  lines.forEach((l) => {
    const text = l.text.trim();
    const isBullet = BULLET.test(text) && text.replace(BULLET, '').length > 0;
    let type = 'p';
    if (isBullet) type = 'li';
    else if (l.size >= body * 1.5) type = 'h1';
    else if ((l.size >= body * 1.12 && (l.allBold || l.upper)) || (l.allBold && l.upper && text.length <= 40)) type = 'h2';
    else if (l.indented && !l.allBold && text.length > 12 && Math.abs(l.size - body) < 0.8) type = 'li';

    const gap = prev ? l.y - prev.y - prev.size : 99;
    const samePage = prev && prev.page === l.page;
    const last = blocks[blocks.length - 1];
    // A line counts as "wrapped" text only if the previous line ran (almost) to the right margin
    // and wasn't a row with a right-aligned part (like a date).
    const wrapped = prev && samePage && gap < l.size * 0.9 && prev.right > prev.rightEdge * 0.85 && !prev.hasBigGap;
    const continuesBullet = last?.type === 'li' && (l.x > last.x + 2 || (!isBullet && Math.abs(l.x - last.x) < 2));

    // Continue the previous paragraph or bullet when the text simply wrapped onto the next line.
    if (last && wrapped && !isBullet && type !== 'h1' && type !== 'h2' && Math.abs(prev.size - l.size) < 0.6
        && ((last.type === 'p' && type === 'p') || continuesBullet)) {
      last.html += ` ${runsToHtml(l.runs)}`;
    } else {
      blocks.push({ type, html: runsToHtml(l.runs, isBullet), x: l.x });
    }
    prev = l;
  });

  let out = '';
  let inList = false;
  blocks.forEach((b) => {
    if (b.type === 'li') {
      if (!inList) { out += '<ul>'; inList = true; }
      out += `<li><p>${b.html}</p></li>`;
      return;
    }
    if (inList) { out += '</ul>'; inList = false; }
    out += `<${b.type}>${b.html}</${b.type}>`;
  });
  if (inList) out += '</ul>';
  return out;
}

// Large embedded pictures would make the document too big to save.
function limitImages(html, warnings) {
  let dropped = 0;
  const out = html.replace(/<img[^>]*src="(data:[^"]+)"[^>]*>/g, (tag, src) => {
    if (src.length * 0.75 > MAX_IMAGE_BYTES) { dropped += 1; return ''; }
    return tag;
  });
  if (dropped) warnings.push(`${dropped} large picture${dropped > 1 ? 's were' : ' was'} left out to keep your document small.`);
  return out;
}
