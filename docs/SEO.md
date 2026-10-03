# WorkScout SEO

WorkScout uses a hybrid SEO model:

- the interactive React application remains at `/`
- crawlable, content-rich landing pages and guides are generated ahead of time
- Cloudflare Static Assets serves those pages directly
- unknown URLs return a real `404`
- `/api/*` responses are marked `X-Robots-Tag: noindex, nofollow`

## Build-time SEO

Run `npm run seo:generate` to regenerate the static SEO surface, sitemap, robots file and llms.txt.

Generated indexable pages:

- `/remote-work/`
- `/freelance-work/`
- `/remote-jobs-new-zealand/`
- `/direct-hiring-leads/`
- `/guides/`
- `/guides/how-to-find-remote-work/`
- `/guides/remote-work-location-restrictions/`
- `/guides/remote-job-scams/`

Each page has its own title, meta description, canonical URL, social metadata, structured data, breadcrumbs and crawlable internal links.

Do not generate large numbers of thin keyword or location pages. Add a page only when it serves a distinct user intent and contains genuinely useful original content.

## Homepage

The homepage includes static fallback HTML in the initial document so crawlers can immediately see the core value proposition and internal links. The React application replaces it when JavaScript starts.

Search query URLs keep the homepage canonical URL so arbitrary `?q=` combinations do not become duplicate indexable pages.

## Crawl controls

`robots.txt` allows the public site and disallows `/api/`. The Worker also sends `X-Robots-Tag: noindex, nofollow` on API responses.

Cloudflare uses `not_found_handling: 404-page` plus `html_handling: auto-trailing-slash`, preventing unknown paths from becoming soft-404 copies of the homepage.

## Search Console launch checklist

1. Submit `https://workscout.nzs.workers.dev/sitemap.xml`.
2. Inspect the homepage and the highest-value landing pages.
3. Request recrawling after meaningful changes.
4. Monitor Page Indexing and Core Web Vitals.
5. Validate structured data with the Rich Results Test.
6. Use actual Search Console queries and click-through rates before creating more content.

Search rankings and rich-result display are controlled by search engines. Markup improves discoverability and eligibility but cannot guarantee placement.
