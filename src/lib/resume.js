import { newId } from './store';

export const SECTION_KEYS = ['summary', 'experience', 'education', 'skills', 'projects', 'custom'];

export const SECTION_LABELS = {
  personal: 'Personal details',
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  custom: 'Additional sections',
};

// Color themes offered in the editor. The color is used for headings, lines, bullets and links.
export const THEMES = [
  { name: 'Indigo', color: '#4f46e5' },
  { name: 'Blue', color: '#1d4ed8' },
  { name: 'Teal', color: '#0f766e' },
  { name: 'Crimson', color: '#b91c1c' },
  { name: 'Charcoal', color: '#111827' },
];
export const ACCENTS = THEMES.map((t) => t.color);

export const emptyExperience = () => ({ id: newId(), role: '', company: '', location: '', start: '', end: '', current: false, bullets: '' });
export const emptyEducation = () => ({ id: newId(), degree: '', school: '', location: '', start: '', end: '', details: '' });
export const emptySkill = () => ({ id: newId(), label: '', items: '' });
export const emptyProject = () => ({ id: newId(), name: '', link: '', start: '', end: '', bullets: '' });
export const emptyCustom = () => ({ id: newId(), title: '', content: '' });

export function blankResume({ name = '', email = '' } = {}) {
  return {
    id: newId(),
    title: 'Untitled resume',
    template: 'modern',
    accent: ACCENTS[0],
    pageSize: 'A4',
    fontDelta: 0,
    spacing: 'default',
    sectionOrder: [...SECTION_KEYS],
    hidden: [],
    data: {
      personal: { fullName: name, headline: '', email, phone: '', location: '', website: '', linkedin: '' },
      summary: '',
      experience: [emptyExperience()],
      education: [emptyEducation()],
      skills: [emptySkill()],
      projects: [],
      custom: [],
    },
  };
}

export const SAMPLE_DATA = {
  personal: {
    fullName: 'Priya Sharma',
    headline: 'Senior Product Designer',
    email: 'priya.sharma@email.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
    website: 'priyasharma.design',
    linkedin: 'linkedin.com/in/priyasharma',
  },
  summary:
    'Product designer with 7+ years of experience shipping consumer apps used by millions. I turn messy problems into simple, measurable experiences and love working closely with engineering and research.',
  experience: [
    {
      id: 'e1', role: 'Senior Product Designer', company: 'Lumen Labs', location: 'Bengaluru', start: 'Mar 2022', end: '', current: true,
      bullets:
        'Led redesign of onboarding flow, lifting day-7 retention by 18%\nBuilt and maintained a 120-component design system adopted by 6 product teams\nMentored 4 designers and ran weekly design critiques',
    },
    {
      id: 'e2', role: 'Product Designer', company: 'Kite Payments', location: 'Mumbai', start: 'Jun 2019', end: 'Feb 2022', current: false,
      bullets:
        'Designed merchant dashboard serving 40k+ small businesses\nCut checkout drop-off by 23% through usability testing and iterative A/B tests\nPartnered with PMs to define quarterly roadmap from research insights',
    },
    {
      id: 'e3', role: 'UX Designer', company: 'Pixelcraft Studio', location: 'Pune', start: 'Jul 2017', end: 'May 2019', current: false,
      bullets: 'Delivered web and mobile projects for 15+ clients across fintech, health and retail\nIntroduced lightweight usability testing into every project',
    },
  ],
  education: [
    { id: 'ed1', degree: 'B.Des, Interaction Design', school: 'National Institute of Design', location: 'Ahmedabad', start: '2013', end: '2017', details: 'Graduated with distinction' },
  ],
  skills: [
    { id: 's1', label: 'Design', items: 'Product design, Interaction design, Prototyping, Design systems' },
    { id: 's2', label: 'Tools', items: 'Figma, Framer, Principle, Maze, Notion' },
    { id: 's3', label: 'Research', items: 'Usability testing, Interviews, Surveys, Analytics' },
  ],
  projects: [
    { id: 'p1', name: 'OpenType Playground', link: 'opentype.dev', start: '2023', end: '', bullets: 'Open-source tool for exploring variable fonts; 2k+ GitHub stars' },
  ],
  custom: [
    { id: 'c1', title: 'Languages', content: 'English (fluent), Hindi (native), Kannada (conversational)' },
    { id: 'c2', title: 'Awards', content: 'Red Dot Design Award — Communication Design, 2021' },
  ],
};

// Empties everything except the person's name and email (used by "Clear example content").
export function clearedData(data) {
  const blank = blankResume().data;
  return { ...blank, personal: { ...blank.personal, fullName: data.personal?.fullName || '', email: data.personal?.email || '' } };
}

export function sampleResume() {
  const r = blankResume();
  return { ...r, title: 'Example resume', data: structuredClone(SAMPLE_DATA) };
}

// Split a textarea into clean lines; tolerant of "-", "•", "*" prefixes.
export const lines = (text) =>
  (text || '')
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);

export const dateRange = (start, end, current) => {
  const e = current ? 'Present' : end;
  if (start && e) return `${start} – ${e}`;
  return start || e || '';
};

export function isEmptyEntry(obj) {
  return Object.entries(obj).every(([k, v]) => k === 'id' || k === 'current' || !String(v || '').trim());
}
