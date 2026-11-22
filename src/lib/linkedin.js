// Reads the PDF that LinkedIn creates with "Save to PDF" on a profile and turns it into
// resume details (name, headline, contact, summary, jobs, education, skills, languages…).
// LinkedIn's own API doesn't give this information to apps, so the PDF is the way in.
import { buildLine, groupLines, readPdfPages } from './importResume';
import { newId } from './store';

const SIDE_HEADINGS = ['contact', 'top skills', 'skills', 'languages', 'certifications', 'honors-awards', 'honors & awards', 'publications', 'patents'];
const MAIN_HEADINGS = ['summary', 'experience', 'education', 'licenses & certifications', 'volunteer experience', 'projects'];
const MONTHS = {
  january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr', may: 'May', june: 'Jun',
  july: 'Jul', august: 'Aug', september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec',
};
const MONTH_RE = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)';
const DATE_PART = `(?:${MONTH_RE}\\s+\\d{4}|\\d{4})`;
const DATE_LINE = new RegExp(`^(${DATE_PART})\\s*[-–—]\\s*(Present|${DATE_PART})(?:\\s*\\(([^)]*)\\))?\\s*$`, 'i');
const DURATION_ONLY = /^\(?\s*(?:less than a year|\d+\s+years?(?:\s+\d+\s+months?)?|\d+\s+months?)\s*\)?$/i;
const FOOTER = /^Page\s+\d+\s+of\s+\d+$/i;

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const shortDate = (s) => {
  const t = clean(s);
  if (/^present$/i.test(t)) return '';
  const m = t.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) return `${MONTHS[m[1].toLowerCase()] || m[1].slice(0, 3)} ${m[2]}`;
  return t;
};

// Turns description lines into one line per bullet/paragraph (the form uses one line per bullet).
function toBullets(lines) {
  const out = [];
  lines.forEach((l, i) => {
    const text = clean(l.text);
    if (!text) return;
    const startsBullet = /^[-•●▪◦*·–]\s*/.test(text);
    const prev = lines[i - 1];
    const newPara = !prev || startsBullet || (l.y - prev.y > l.size * 1.9) || l.page !== prev.page;
    const t = text.replace(/^[-•●▪◦*·–]\s*/, '');
    if (newPara || !out.length) out.push(t); else out[out.length - 1] += ` ${t}`;
  });
  return out.join('\n');
}

export function isLinkedInPdf(lines) {
  const texts = lines.map((l) => clean(l.text).toLowerCase());
  const hits = ['contact', 'experience', 'education', 'top skills', 'summary'].filter((h) => texts.includes(h)).length;
  return hits >= 2 || texts.some((t) => /linkedin\.com\/in\//.test(t)) || texts.some((t) => FOOTER.test(t));
}

export async function readLinkedInPdf(file) {
  if (!file) throw new Error('No file selected.');
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    throw new Error('Please upload the PDF from LinkedIn (Profile → More → Save to PDF).');
  }
  const pages = await readPdfPages(await file.arrayBuffer());

  // Split each page into the grey sidebar (left) and the main column (right).
  const side = [];
  const main = [];
  let splitX = null;
  pages.forEach(({ number, items, pageW }) => {
    const visible = items.filter((i) => i.str.trim() && !FOOTER.test(i.str.trim()));
    if (number === 1 || splitX == null) {
      const contact = visible.find((i) => /^(contact|top skills)$/i.test(i.str.trim()) && i.x < pageW * 0.35);
      if (contact) {
        const right = visible.filter((i) => i.x > contact.x + pageW * 0.15).map((i) => i.x);
        if (right.length) splitX = Math.min(...right) - 2;
      }
    }
    const isSide = (i) => splitX != null && i.x < splitX;
    const toLines = (arr) => groupLines(arr)
      .map((l) => ({ ...buildLine(l), page: number }))
      .filter((l) => !FOOTER.test(clean(l.text)) && !/^[\s·.•,|-]*$/.test(l.text));
    side.push(...toLines(visible.filter(isSide)));
    main.push(...toLines(visible.filter((i) => !isSide(i))));
  });
  const all = [...side, ...main].filter((l) => clean(l.text));
  if (!all.length) throw new Error('We couldn’t find any text in that PDF.');
  if (!isLinkedInPdf(all)) {
    throw new Error('This doesn’t look like a LinkedIn profile PDF. On LinkedIn, open your profile, click “More” (or “Resources”), then “Save to PDF”, and upload that file.');
  }

  // ── Sidebar sections ──
  const sideSections = {};
  let current = null;
  side.forEach((l) => {
    const t = clean(l.text);
    if (SIDE_HEADINGS.includes(t.toLowerCase())) { current = t.toLowerCase(); sideSections[current] = []; return; }
    if (current) sideSections[current].push(l);
  });
  const contactText = (sideSections.contact || []).map((l) => clean(l.text)).join(' ');
  const contactJoined = (sideSections.contact || []).map((l) => clean(l.text)).join('');
  const email = (contactText.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/) || [''])[0];
  const linkedinMatch = contactJoined.match(/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+/i);
  const linkedin = linkedinMatch ? linkedinMatch[0].replace(/^www\./i, '') : '';
  const phoneMatch = contactText.match(/(\+?\d[\d\s().-]{7,}\d)\s*\((?:Mobile|Home|Work)\)/i);
  const phone = phoneMatch ? clean(phoneMatch[1]) : '';
  const siteMatch = contactText
    .replace(/(?:www\.)?linkedin\.com\/in\/\S+/gi, '')
    .match(/((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?)\s*\((?:Portfolio|Personal|Company|Blog|Other|RSS Feed)\)/i);
  const website = siteMatch ? siteMatch[1] : '';
  // Sidebar lists (skills, languages, certifications…): long entries wrap onto a second line.
  // Wrapped lines sit closer together than separate entries; if the spacing doesn't tell them
  // apart, a line that ran almost to the column's edge is treated as wrapped.
  const sideRight = Math.max(0, ...side.map((l) => l.right));
  const sideList = (key) => {
    const arr = (sideSections[key] || []).filter((l) => clean(l.text));
    const gaps = arr.slice(1).map((l, i) => (l.page === arr[i].page ? l.y - arr[i].y : Infinity)).filter((g) => g !== Infinity);
    const minGap = gaps.length ? Math.min(...gaps) : 0;
    const spacingTells = gaps.some((g) => g > minGap + 1.5);
    const out = [];
    arr.forEach((l, i) => {
      const t = clean(l.text);
      const prev = arr[i - 1];
      let wrapped = false;
      if (prev && prev.page === l.page) {
        const gap = l.y - prev.y;
        wrapped = spacingTells ? gap <= minGap + 1 : (gap < l.size * 1.6 && prev.right > sideRight * 0.9);
      }
      if (wrapped && out.length) out[out.length - 1] += ` ${t}`; else out.push(t);
    });
    return out;
  };

  // ── Main column ──
  const firstHeading = main.findIndex((l) => MAIN_HEADINGS.includes(clean(l.text).toLowerCase()));
  const header = (firstHeading === -1 ? main.slice(0, 4) : main.slice(0, firstHeading)).filter((l) => clean(l.text));
  let fullName = '';
  let headline = '';
  let location = '';
  if (header.length) {
    const biggest = header.reduce((a, b) => (b.size > a.size ? b : a), header[0]);
    const nameIdx = header.indexOf(biggest);
    fullName = clean(biggest.text);
    const rest = header.slice(nameIdx + 1).map((l) => clean(l.text));
    if (rest.length >= 2) { location = rest[rest.length - 1]; headline = rest.slice(0, -1).join(' '); } else if (rest.length === 1) headline = rest[0];
  }

  const mainSections = {};
  current = null;
  main.slice(Math.max(0, firstHeading)).forEach((l) => {
    const t = clean(l.text);
    if (MAIN_HEADINGS.includes(t.toLowerCase())) { current = t.toLowerCase(); mainSections[current] = []; return; }
    if (current) mainSections[current].push(l);
  });

  const summary = toBullets(mainSections.summary || []).replace(/\n/g, '\n\n');
  const experience = parseExperience(mainSections.experience || []);
  const education = parseEducation(mainSections.education || []);

  const topSkills = sideList('top skills').concat(sideList('skills'));
  const custom = [];
  const langs = sideList('languages');
  if (langs.length) custom.push({ id: newId(), title: 'Languages', content: langs.join(', ') });
  const certs = sideList('certifications');
  if (certs.length) custom.push({ id: newId(), title: 'Certifications', content: certs.join('\n') });
  const awards = sideList('honors-awards').concat(sideList('honors & awards'));
  if (awards.length) custom.push({ id: newId(), title: 'Awards', content: awards.join('\n') });

  const data = {
    personal: { fullName, headline, email, phone, location, website, linkedin },
    summary,
    experience,
    education,
    skills: topSkills.length ? [{ id: newId(), label: '', items: topSkills.join(', ') }] : [],
    projects: [],
    custom,
  };
  if (!fullName && !experience.length) throw new Error('We couldn’t read the details from that PDF. Please make sure it’s the “Save to PDF” file from your LinkedIn profile.');
  return data;
}

function parseExperience(lines) {
  const L = lines.filter((l) => clean(l.text));
  if (!L.length) return [];
  // The most common size is the description text; company names and job titles are larger.
  const sizes = {};
  L.forEach((l) => { const k = Math.round(l.size * 2) / 2; sizes[k] = (sizes[k] || 0) + 1; });
  const body = Number(Object.entries(sizes).sort((a, b) => b[1] - a[1])[0][0]);
  const isHeaderSize = (l) => l.size > body + 0.3;

  const dateIdx = L.map((l, i) => (DATE_LINE.test(clean(l.text)) ? i : -1)).filter((i) => i >= 0);
  const roles = [];
  let company = '';
  dateIdx.forEach((di, n) => {
    const titleIdx = di - 1;
    const prevDate = n > 0 ? dateIdx[n - 1] : -1;
    let headerStart = titleIdx;
    const before = L[titleIdx - 1];
    if (titleIdx - 1 > prevDate && before) {
      const bt = clean(before.text);
      if (DURATION_ONLY.test(bt) && L[titleIdx - 2] && titleIdx - 2 > prevDate) {
        company = clean(L[titleIdx - 2].text);
        headerStart = titleIdx - 2;
      } else if (n === 0 || isHeaderSize(before) || (bt.length < 60 && !/[.:]$/.test(bt) && before.size >= L[titleIdx].size - 0.2 && isHeaderSize(L[titleIdx]) && before.size > body)) {
        company = bt;
        headerStart = titleIdx - 1;
      }
    }
    const m = clean(L[di].text).match(DATE_LINE);
    roles.push({ titleIdx, headerStart, di, company, role: clean(L[titleIdx]?.text), start: shortDate(m[1]), end: shortDate(m[2]), current: /present/i.test(m[2]) });
  });

  return roles.map((r, n) => {
    const nextStart = n + 1 < roles.length ? roles[n + 1].headerStart : L.length;
    let descStart = r.di + 1;
    let location = '';
    const maybeLoc = L[descStart];
    if (maybeLoc && descStart < nextStart) {
      const t = clean(maybeLoc.text);
      if (t.length < 70 && !/[.!?]$/.test(t) && !/^[-•●*]/.test(t) && (t.includes(',') || /remote|india|area|united|usa|uk|hybrid|on-site/i.test(t) || t.split(' ').length <= 4)) {
        location = t;
        descStart += 1;
      }
    }
    return {
      id: newId(),
      role: r.role,
      company: r.company,
      location,
      start: r.start,
      end: r.current ? '' : r.end,
      current: r.current,
      bullets: toBullets(L.slice(descStart, nextStart)),
    };
  });
}

function parseEducation(lines) {
  const L = lines.filter((l) => clean(l.text));
  const out = [];
  let schoolBuf = [];
  const flushSchoolOnly = () => {
    if (schoolBuf.length) out.push({ id: newId(), degree: '', school: clean(schoolBuf.join(' ')), location: '', start: '', end: '', details: '' });
    schoolBuf = [];
  };
  L.forEach((l, idx) => {
    const t = clean(l.text);
    const years = t.match(/\(\s*(?:[A-Za-z]+\s+)?(\d{4})\s*[-–—]\s*(?:[A-Za-z]+\s+)?(\d{4}|Present)?\s*\)\s*$/i);
    if (t.includes('·') || years) {
      // "Bachelor of Technology - BTech, Computer Science · (2016 - 2020)" — or just "· (2017 - 2018)"
      let degree = clean(t.split('·')[0].replace(/\(.*\)\s*$/, ''));
      if (!degree && years && !t.includes('·')) degree = clean(t.replace(years[0], ''));
      degree = degree.replace(/^[\s·.,•|-]+|[\s·.,•|-]+$/g, '');
      out.push({
        id: newId(),
        degree,
        school: clean(schoolBuf.join(' ')),
        location: '',
        start: years ? years[1] : '',
        end: years && years[2] && !/present/i.test(years[2]) ? years[2] : '',
        details: '',
      });
      schoolBuf = [];
      return;
    }
    const prev = L[idx - 1];
    const wrapsSchoolName = schoolBuf.length && prev && prev.page === l.page
      && l.y - prev.y < l.size * 1.6 && Math.abs(l.size - prev.size) < 0.3;
    if (wrapsSchoolName) schoolBuf.push(t);
    else { flushSchoolOnly(); schoolBuf = [t]; }
  });
  flushSchoolOnly();
  return out;
}

// Combines LinkedIn details with an example resume: anything LinkedIn doesn't have stays empty
// (rather than showing someone else's example details).
export function resumeDataFromLinkedIn(li) {
  const fresh = (arr) => (arr || []).map((x) => ({ ...x, id: newId() }));
  return {
    personal: { ...li.personal },
    summary: li.summary || '',
    experience: fresh(li.experience),
    education: fresh(li.education),
    skills: fresh(li.skills),
    projects: fresh(li.projects),
    custom: fresh(li.custom),
  };
}
