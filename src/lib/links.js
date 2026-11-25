// Contact links (LinkedIn, Portfolio, GitHub…): each has a short label shown on the resume
// and the full address it opens. Older resumes kept just "website" and "linkedin" fields.
import { newId } from './store';

const KNOWN = [
  [/linkedin\.com/i, 'LinkedIn'],
  [/github\.com/i, 'GitHub'],
  [/behance\.net/i, 'Behance'],
  [/dribbble\.com/i, 'Dribbble'],
  [/medium\.com/i, 'Medium'],
  [/(twitter|x)\.com/i, 'X'],
  [/instagram\.com/i, 'Instagram'],
  [/youtube\.com|youtu\.be/i, 'YouTube'],
  [/figma\.com/i, 'Figma'],
  [/notion\.(so|site)/i, 'Notion'],
  [/gitlab\.com/i, 'GitLab'],
  [/stackoverflow\.com/i, 'Stack Overflow'],
  [/kaggle\.com/i, 'Kaggle'],
  [/leetcode\.com/i, 'LeetCode'],
];

export const LINK_SUGGESTIONS = ['LinkedIn', 'Portfolio', 'GitHub', 'Behance', 'Dribbble', 'Website'];

// A sensible label for an address, e.g. "linkedin.com/in/you" → "LinkedIn".
export function guessLabel(url) {
  const u = (url || '').trim();
  if (!u) return '';
  const hit = KNOWN.find(([re]) => re.test(u));
  return hit ? hit[1] : 'Portfolio';
}

// Shorter address for when there's no label: "https://www.site.com/" → "site.com".
export const shortUrl = (url) => (url || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');

// The links to show for a person, including ones from older resumes.
export function linksOf(p = {}) {
  if (Array.isArray(p.links)) return p.links;
  const out = [];
  if (p.linkedin) out.push({ id: 'linkedin', label: 'LinkedIn', url: p.linkedin });
  if (p.website) out.push({ id: 'website', label: guessLabel(p.website) === 'Portfolio' ? 'Website' : guessLabel(p.website), url: p.website });
  return out;
}

export const newLink = (label = '', url = '') => ({ id: newId(), label, url });
