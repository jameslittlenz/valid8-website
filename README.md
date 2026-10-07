# Valid8 Advisory website

Static site built with [Astro](https://astro.build), implemented from the Claude Design mockups in `project/` (see `DESIGN_HANDOFF.md` and `chats/`).

```sh
npm install
npm run dev      # http://localhost:4321, drafts visible
npm run build    # static site in dist/, drafts excluded
npm run preview  # serve dist/
npm run check    # type-check
```

`dist/` is plain HTML/CSS with a few lines of JS (mobile menu, blog filter, copy-link).

## Deployment

Every push to `main` builds and publishes the site to GitHub Pages via `.github/workflows/deploy.yml`
(Settings → Pages → Source must be **GitHub Actions**). It's served at
https://jameslittlenz.github.io/valid8-website/ until a custom domain is set.

The site lives under `/valid8-website/` on that URL, so internal links and images go through `u()` in
`src/url.ts`, which adds the base path. Use `u('/about/')` rather than a bare `'/about/'` in new
templates. Image paths in post frontmatter are handled automatically. Adding a custom domain in
Settings → Pages needs no code changes: the workflow picks up the new URL and drops the base path.

## Pages

| URL | File |
| --- | --- |
| `/` | `src/pages/index.astro` |
| `/offerings/` | `src/pages/offerings.astro` |
| `/use-cases/` | `src/pages/use-cases.astro` |
| `/about/` | `src/pages/about.astro` |
| `/blog/` | `src/pages/blog/index.astro` |
| `/blog/<post>/` | `src/pages/blog/[slug].astro` + `src/content/posts/<post>.md` |

Header and footer live in `src/components/`. Colours are CSS variables in `src/styles/global.css`; dark mode follows the visitor's system setting (`prefers-color-scheme`), with no toggle.

## Adding blog posts and media coverage

Every entry on the blog page is one Markdown file in `src/content/posts/`. The file name becomes the URL.

**An article (Insights)** — frontmatter plus the article in Markdown below it:

```md
---
title: Preparing for Trust Framework accreditation
date: 2026-10-20
author: James Little            # must be a name listed in src/data/site.ts
category: Insights
excerpt: Readiness, scoping and evidence: what the Trust Framework Authority expects to see.
image: /assets/beehive.jpg      # put new images in public/assets/
imagePosition: center 30%       # optional, CSS object-position
imageAlt: The Beehive, Wellington
imageCaption: Optional caption under the hero image.
---

Article text in normal Markdown: ## headings, **bold**, lists, > quotes, [links](https://…).
```

**Media coverage (In the media)** — no body, just a link out:

```md
---
title: 'OK computer: The coming revolution in digital IDs'
date: 2026-08-29
author: James Little
category: In the media
excerpt: '“A pull quote from the piece.”'
image: /assets/media-article.jpg
url: https://www.nzherald.co.nz/…
outlet: NZ Herald                # shown as “Read on NZ Herald ↗”
featured: true                   # optional: big card at the top of the blog page
---
```

Other options: `draft: true` shows a post in `npm run dev` only. Frontmatter is validated (`src/content.config.ts`), so a typo in a field or an unknown author fails the build instead of shipping a broken page.

To add an author, add them to `authors` in `src/data/site.ts`.

## Open items from the design

- Three Insights posts (`from-federated-identity…`, `preparing-for-trust-framework…`, `iso-18013-5…`) are sample titles from the mockups with no text. They're marked `draft: true`, so they don't appear on the live site until written.
- The two Chris Goh media items have no link yet. Add `url:` and `outlet:` to make their cards clickable.
- The DISTF article text was written by the design tool as sample copy and needs James's review.
