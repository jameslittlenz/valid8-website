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
