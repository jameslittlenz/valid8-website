// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL and BASE_PATH are set by the GitHub Pages workflow (.github/workflows/deploy.yml).
// On https://jameslittlenz.github.io/valid8-website/ the base path is /valid8-website.
// With a custom domain set in the repo's Pages settings, the base path becomes empty
// and nothing here needs to change.
export default defineConfig({
  site: process.env.SITE_URL || undefined,
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'always',
});
