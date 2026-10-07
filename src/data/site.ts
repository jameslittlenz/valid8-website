export type NavId = 'home' | 'offerings' | 'use-cases' | 'about' | 'blog';

export const navLinks: { id: NavId; label: string; href: string }[] = [
  { id: 'offerings', label: 'Offerings', href: '/offerings/' },
  { id: 'use-cases', label: 'Use cases', href: '/use-cases/' },
  { id: 'about', label: 'About', href: '/about/' },
  { id: 'blog', label: 'Blog', href: '/blog/' },
];

/** People who can be named as a post author. Keys match `author` in post frontmatter. */
export const authors = {
  'James Little': {
    role: 'New Zealand Lead',
    bio: 'New Zealand Lead at Valid8 Advisory and contributing author on the DISTF Reference Architecture.',
    photo: '/assets/james-little.jpg',
    photoPosition: '50% 25%',
  },
  'Chris Goh': {
    role: 'Founder and Director',
    bio: 'Founder and Director of Valid8 Advisory.',
    photo: '/assets/chris-goh-speaking.jpg',
    photoPosition: '60% 30%',
  },
} as const;

export type AuthorName = keyof typeof authors;

export const serviceAreas = [
  'Strategic Planning',
  'Governance and Customer Experience',
  'Architecture and Design',
  'Business Case Development',
  'Program and Project Management',
  'Community Change Management',
  'Security and Privacy',
  'Regulation and Policy Alignment',
  'Procurement and Service Management',
  'Operating and Commercial Models',
  'Testing, Conformance, and Certification',
];

export const engagementModels: [string, string][] = [
  ['Kickstart Package', 'Three one-hour pre-meetings plus an onsite workshop of one to three days, for organisations unsure where to begin.'],
  ['Advisory Package', 'A capped retainer that gives executives flexibility as initiatives scale.'],
  ['Statement of Work', 'Fixed-scope engagements with clearly defined deliverables and timelines.'],
  ['Contracting', 'Subject matter experts to support your existing engagements, on a time-and-materials or fixed-price basis.'],
];

export const journeyEntryPoints = [
  'At the start of the journey, wanting your key stakeholders’ views on vision, mission and direction',
  'Developing a business case that sets out the value proposition and the risks',
  'Running a procurement, with market guidance and clear requirements',
  'Transitioning to international standards for verifiable credentials at minimal cost',
  'Responding to a government directive and planning implementation',
];
