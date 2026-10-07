const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix a root-relative path with the site's base path (e.g. /valid8-website on GitHub Pages). */
export function u(path: string): string {
  return path.startsWith('/') ? base + path : path;
}
