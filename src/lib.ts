import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/** All posts, newest first. Drafts are only included in dev. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** A post has its own page when it has body text and isn't external media coverage. */
export function hasPage(post: Post): boolean {
  return !post.data.url && Boolean(post.body?.trim());
}

/** Where a post card should link to, or undefined if there's nowhere to go yet. */
export function postHref(post: Post): string | undefined {
  if (post.data.url) return post.data.url;
  if (hasPage(post)) return `/blog/${post.id}/`;
  return undefined;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
