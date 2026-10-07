import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { authors } from './data/site';

const authorNames = Object.keys(authors) as [keyof typeof authors, ...(keyof typeof authors)[]];

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.enum(authorNames),
    category: z.enum(['Insights', 'In the media']),
    /** Shown on cards, and as the standfirst on article pages. */
    excerpt: z.string(),
    image: z.string(),
    imagePosition: z.string().default('center'),
    imageAlt: z.string().default(''),
    imageCaption: z.string().optional(),
    /** Media coverage hosted elsewhere. Cards link here instead of to a page on this site. */
    url: z.url().optional(),
    /** Name of the outlet, used for the "Read on …" link. */
    outlet: z.string().optional(),
    /** Shown as the large card at the top of the blog page. Only the newest featured post is used. */
    featured: z.boolean().default(false),
    /** Drafts appear in `npm run dev` but are left out of production builds. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
