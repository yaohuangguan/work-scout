import fs from "node:fs/promises";
import path from "node:path";

const ORIGIN = "https://workscout.nzs.workers.dev";
const UPDATED = "2026-10-04";
const out = path.resolve("public");

const pages = [
  {
    slug: "remote-work",
    title: "Find Remote Work That Actually Fits | WorkScout",
    description: "Search remote jobs, freelance contracts and direct hiring leads while checking location restrictions, schedule fit and freshness before you apply.",
    eyebrow: "Remote work search",
    h1: "Find remote work you can actually take",
    intro: "Remote does not always mean worldwide. WorkScout searches formal job feeds and direct hiring leads, then surfaces the location, work type, freshness and match evidence before you spend time applying.",
    ctaQuery: "remote work",
    sections: [
      ["Why remote job search is harder than it looks", [
        "Many listings use the word “remote” while still requiring a specific country, timezone, employment status or full-time schedule. That creates a lot of dead-end clicking.",
        "WorkScout treats eligibility as part of discovery. Results can be marked as likely eligible, uncertain or restricted, with the original source always preserved so you can verify the details yourself."
      ]],
      ["Jobs and direct hiring leads in one search", [
        "Traditional job boards are useful, but some of the most actionable work never becomes a formal job listing. A founder may ask for a React contractor, a business may need short-form video editing, or a team may post a paid technical task in a community.",
        "WorkScout normalizes both formal listings and direct leads into one result model, while keeping them visibly distinct. You can filter for direct leads when you want faster, more flexible work."
      ]],
      ["What WorkScout checks", [
        "The ranking looks at your search terms, location, weekly availability, work type, freshness and source evidence. It is not a promise that you qualify; it is a way to move the most plausible opportunities to the top and expose restrictions earlier.",
        "For ongoing searches, Scout Watch can remember a query and periodically check for new matches. Apply Pipeline then lets you move promising work through Saved, Contacted, Applied, Interview, Offer or Closed."
      ]]
    ],
    related: [
      ["/direct-hiring-leads/", "Direct hiring leads"],
      ["/freelance-work/", "Freelance and contract work"],
      ["/guides/remote-work-location-restrictions/", "Understand remote location restrictions"]
    ]
  },
  {
    slug: "freelance-work",
    title: "Freelance & Contract Work Leads | WorkScout",
    description: "Discover remote freelance gigs, contract work and direct hiring leads from job feeds and public hiring communities, with source links and fit signals.",
    eyebrow: "Freelance discovery",
    h1: "Find freelance and contract work beyond job boards",
    intro: "Freelance work is scattered across job feeds, hiring threads, communities and direct posts. WorkScout brings those signals together without pretending every lead is a formal job.",
    ctaQuery: "freelance contract work",
    sections: [
      ["Why direct leads matter", [
        "Smaller paid projects often appear as a post, thread or direct request rather than a polished vacancy. Those opportunities can be especially useful when you want contract, part-time or project-based work.",
        "WorkScout marks this class of opportunity as a Lead and keeps a link back to the original source. That makes the context visible instead of stripping a lead down to a title and company name."
      ]],
      ["Search by capability, not only job title", [
        "You can describe what you can do in normal language: React and Node, customer support in two languages, video editing for short-form content, Excel work in the evenings, or AI automation for small businesses.",
        "The query planner expands useful terms, retrieves opportunities from multiple sources and ranks the normalized results against the constraints you provide."
      ]],
      ["Turn discovery into a workflow", [
        "Saving a link is not the same as following through. Apply Pipeline keeps a lightweight record of where each opportunity stands, while Scout Watch helps you avoid repeating the same searches every day.",
        "WorkScout is intentionally source-transparent: contact or apply through the original source, and use the product to discover, prioritize and track."
      ]]
    ],
    related: [
      ["/remote-work/", "Remote work search"],
      ["/direct-hiring-leads/", "Direct hiring leads"],
      ["/guides/how-to-find-remote-work/", "How to find real remote work"]
    ]
  },
  {
    slug: "remote-jobs-new-zealand",
    title: "Remote Jobs in New Zealand | WorkScout",
    description: "Find remote jobs and contract work that can be done from New Zealand. WorkScout highlights location restrictions, flexibility and direct hiring leads.",
    eyebrow: "New Zealand remote work",
    h1: "Remote jobs you can do from New Zealand",
    intro: "A large share of “remote” vacancies are limited to the US, Europe or another hiring region. WorkScout puts New Zealand eligibility closer to the top of the search instead of making you discover the restriction after several clicks.",
    ctaQuery: "remote work from New Zealand",
    sections: [
      ["Remote does not mean globally remote", [
        "Employers may restrict remote roles because of payroll, tax, legal entity, customer coverage or timezone requirements. A listing can be fully remote and still unavailable to someone based in New Zealand.",
        "WorkScout uses the location text and other signals in each source to classify the opportunity as likely eligible, uncertain or restricted. Uncertain stays uncertain; the product does not invent eligibility when the source is vague."
      ]],
      ["Look beyond full-time employment", [
        "Contract, freelance, part-time and direct project work can have fewer location constraints than a conventional employee role. WorkScout lets you include those work types in the same search.",
        "This is especially useful when a company cannot employ in New Zealand but can legally work with an independent contractor. Always verify the actual arrangement with the hiring party."
      ]],
      ["Keep the original evidence", [
        "Every WorkScout result points back to the original listing or hiring post. The search layer is designed to prioritize and explain, not to replace the source.",
        "Use Scout Watch for recurring New Zealand searches and the Apply Pipeline to track which opportunities you have contacted or applied to."
      ]]
    ],
    related: [
      ["/remote-work/", "Remote work search"],
      ["/freelance-work/", "Freelance and contract work"],
      ["/guides/remote-work-location-restrictions/", "Remote location restrictions explained"]
    ]
  },
  {
    slug: "direct-hiring-leads",
    title: "Direct Hiring Leads for Remote Work | WorkScout",
    description: "Find direct remote hiring leads from public communities and hiring threads alongside standard job listings. See the source, freshness and match evidence.",
    eyebrow: "Beyond formal listings",
    h1: "Find direct hiring leads before they become job listings",
    intro: "Not all paid work starts with a careers page. WorkScout searches public hiring communities and freelancer threads alongside standard remote-job feeds, then labels direct leads clearly.",
    ctaQuery: "direct hiring freelance lead",
    sections: [
      ["What counts as a direct hiring lead", [
        "A direct lead is a public request for help or talent where the hiring intent is visible but the opportunity may not have a formal application system. Examples include a founder looking for a contractor, a paid implementation task or a team asking for a freelancer.",
        "WorkScout does not silently transform these into “jobs”. Lead is a separate opportunity type so you can decide whether that style of work fits you."
      ]],
      ["Why source transparency matters", [
        "Context matters more for informal opportunities. The original thread can show who posted it, when it appeared, how people should respond and whether the scope has changed.",
        "That is why WorkScout preserves the original source and only uses its own ranking as a discovery aid. You should still assess the poster, payment terms and legitimacy yourself."
      ]],
      ["Freshness and follow-through", [
        "Direct leads can expire quickly. WorkScout therefore includes freshness in ranking and lets Scout Watch remember a search so newly discovered matching leads stand out from the baseline.",
        "When you decide to pursue one, Apply Pipeline provides a simple way to track Contacted, Applied and later stages without forcing you into a separate CRM."
      ]]
    ],
    related: [
      ["/freelance-work/", "Freelance work"],
      ["/guides/remote-job-scams/", "Spot remote-work scams"],
      ["/remote-work/", "Search all remote work"]
    ]
  },
  {
    slug: "guides",
    title: "Remote Work Guides & Practical Advice | WorkScout",
    description: "Practical guides for finding remote work, understanding location restrictions, evaluating direct leads and avoiding common remote-job scams.",
    eyebrow: "Remote work guides",
    h1: "Practical guides for finding better remote work",
    intro: "WorkScout is built around reducing dead ends. These guides explain how to search more effectively, interpret remote eligibility and evaluate opportunities before you invest time in them.",
    ctaQuery: "remote work",
    sections: [
      ["Search with fewer dead ends", [
        "A useful remote-work process starts by screening location, work type and freshness early. That lets you spend more time on plausible opportunities and less time discovering restrictions at the end of a listing.",
        "The guides below focus on practical decision points rather than generic career advice."
      ]],
      ["Use source evidence, not just ranking", [
        "WorkScout can prioritize opportunities, but the original listing or hiring post remains the source of truth. Read it, verify it and keep uncertainty visible when the source is vague.",
        "That principle matters for both formal jobs and direct hiring leads."
      ]]
    ],
    related: [
      ["/guides/how-to-find-remote-work/", "How to find real remote work"],
      ["/guides/remote-work-location-restrictions/", "Remote location restrictions"],
      ["/guides/remote-job-scams/", "Remote-job scam checklist"]
    ]
  },
  {
    slug: "guides/how-to-find-remote-work",
    title: "How to Find Real Remote Work in 2026 | WorkScout Guide",
    description: "A practical guide to finding real remote work: search job feeds and direct leads, verify eligibility early, prioritize fresh opportunities and track follow-up.",
    eyebrow: "WorkScout guide",
    h1: "How to find real remote work without wasting hours",
    intro: "The fastest improvement to a remote-work search is not another giant list of vacancies. It is reducing dead ends: roles you cannot legally take, stale listings, weak matches and leads you forget to follow up.",
    article: true,
    ctaQuery: "remote contract work",
    sections: [
      ["1. Search for capabilities as well as titles", [
        "Titles vary wildly between companies. The same work might be advertised as frontend engineer, product engineer, web developer, implementation specialist or technical contractor.",
        "Describe the work you can perform and include constraints that matter, such as part-time availability, contract preference, language skills or timezone. This creates a broader but more relevant discovery surface."
      ]],
      ["2. Check eligibility before reading the whole listing", [
        "A remote label is not enough. Look for country, region, employment entity and timezone requirements immediately. If the source is ambiguous, treat it as unknown rather than assuming worldwide eligibility.",
        "Filtering this early saves more time than almost any resume optimization trick because it removes applications that had no realistic path in the first place."
      ]],
      ["3. Mix formal jobs with direct leads", [
        "Job boards are strongest for structured hiring. Communities and direct posts are often stronger for smaller contracts, urgent projects and flexible work. Use both instead of expecting one source to contain the whole market.",
        "For direct leads, read the original context and assess the poster before sharing personal information or starting work."
      ]],
      ["4. Prioritize freshness", [
        "For crowded remote roles, a strong application sent while the opportunity is fresh can be more valuable than a perfect application sent after hundreds of candidates have arrived.",
        "Saved searches and recurring watches reduce the delay between a new opportunity appearing and you seeing it."
      ]],
      ["5. Track the next action", [
        "A good search process should answer “what should I do next?” for every promising opportunity. Saved, Contacted, Applied, Interview, Offer and Closed is enough structure for most people.",
        "The goal is not to build a complicated CRM. It is to prevent good leads from disappearing into browser tabs and bookmarks."
      ]]
    ],
    related: [
      ["/remote-work/", "Search remote work"],
      ["/guides/remote-work-location-restrictions/", "Location restrictions"],
      ["/guides/remote-job-scams/", "Remote-job scam checklist"]
    ]
  },
  {
    slug: "guides/remote-work-location-restrictions",
    title: "Why Remote Jobs Have Location Restrictions | WorkScout",
    description: "Understand why remote jobs can still be country- or timezone-restricted, what worldwide remote really means, and how to screen eligibility before applying.",
    eyebrow: "WorkScout guide",
    h1: "Why a “remote” job can still be unavailable where you live",
    intro: "Remote describes where the work happens. It does not automatically describe where the employer can hire. Payroll, tax, legal entities, working hours and customer coverage can all create location restrictions.",
    article: true,
    ctaQuery: "worldwide remote contract",
    sections: [
      ["Country and legal-entity restrictions", [
        "An employer may only be set up to hire employees in certain countries. Even if the team is distributed, the company may not have payroll, tax registration or an employer-of-record arrangement everywhere.",
        "This is why phrases such as “remote — US only”, “must be based in the EU” or “remote within Australia” are common. They are not contradictions; they describe a remote role inside a hiring boundary."
      ]],
      ["Timezone and overlap requirements", [
        "Some companies can hire globally but still need several hours of overlap with customers or the rest of the team. Timezone restrictions are therefore different from legal location restrictions, but they can be just as important.",
        "Look for explicit UTC ranges, business-hour overlap or region labels such as APAC, EMEA and Americas."
      ]],
      ["Employee versus contractor", [
        "A company that cannot employ someone in a country may still be able to engage an independent contractor there. That does not mean every contractor arrangement is valid or appropriate; local tax, immigration and employment rules still matter.",
        "Treat the work type as a separate eligibility signal and verify the actual contract before accepting."
      ]],
      ["How WorkScout handles uncertainty", [
        "WorkScout surfaces likely eligibility, uncertainty and restriction as different states. If a listing does not provide enough evidence, it should stay uncertain rather than being promoted as globally available.",
        "The original source remains one click away so you can verify the wording before applying."
      ]]
    ],
    related: [
      ["/remote-jobs-new-zealand/", "Remote jobs from New Zealand"],
      ["/remote-work/", "Search remote work"],
      ["/guides/how-to-find-remote-work/", "Remote-work search guide"]
    ]
  },
  {
    slug: "guides/remote-job-scams",
    title: "Remote Job Scam Checklist | WorkScout Guide",
    description: "A practical checklist for evaluating remote jobs and freelance leads: verify the source, identity, payment terms, scope and suspicious requests before you engage.",
    eyebrow: "WorkScout guide",
    h1: "A practical checklist for spotting remote-work scams",
    intro: "Remote work creates legitimate opportunities, but distance also makes impersonation and low-trust offers easier. Use the original source, independent verification and clear payment terms before you commit.",
    article: true,
    ctaQuery: "remote contract work",
    sections: [
      ["Verify who is hiring", [
        "Check whether the company, domain and person are consistent with each other. A familiar company name does not make an unrelated email address or messaging account legitimate.",
        "When possible, navigate to the company through its official site rather than relying only on a link supplied in a message."
      ]],
      ["Be suspicious of money moving through you", [
        "A legitimate hiring process should not require you to buy gift cards, forward money, deposit a suspicious cheque, purchase equipment from a mandated unknown vendor or share banking credentials before a real contract exists.",
        "For freelance work, agree on scope, payment method, milestones and who owns the deliverable before doing substantial unpaid work."
      ]],
      ["Watch for pressure and identity harvesting", [
        "Urgency can be real, but extreme pressure to provide passport scans, financial details or account credentials before basic verification is a red flag.",
        "Share only the information needed for the current stage of the process. Keep records of the original posting and communication."
      ]],
      ["Use source context as evidence", [
        "Direct hiring leads can be valuable, but the surrounding thread, account history and original wording matter. WorkScout keeps the original source visible for that reason.",
        "A ranking score or search match is never a safety guarantee. Treat it as discovery, then perform your own verification."
      ]]
    ],
    related: [
      ["/direct-hiring-leads/", "Direct hiring leads"],
      ["/guides/how-to-find-remote-work/", "How to find remote work"],
      ["/freelance-work/", "Freelance and contract work"]
    ]
  }
];

const nav = `
  <a href="/">WorkScout</a>
  <a href="/remote-work/">Remote work</a>
  <a href="/freelance-work/">Freelance</a>
  <a href="/remote-jobs-new-zealand/">New Zealand</a>
  <a href="/direct-hiring-leads/">Direct leads</a>
  <a href="/guides/">Guides</a>
`;

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function json(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function render(page) {
  const url = `${ORIGIN}/${page.slug}/`;
  const breadcrumbs = page.slug.startsWith("guides/")
    ? [
        { name: "Home", item: `${ORIGIN}/` },
        { name: "Guides", item: `${ORIGIN}/guides/` },
        { name: page.h1, item: url }
      ]
    : [
        { name: "Home", item: `${ORIGIN}/` },
        { name: page.h1, item: url }
      ];

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${ORIGIN}/#website`,
        url: `${ORIGIN}/`,
        name: "WorkScout",
        inLanguage: "en",
        publisher: { "@id": `${ORIGIN}/#organization` }
      },
      {
        "@type": "Organization",
        "@id": `${ORIGIN}/#organization`,
        name: "WorkScout",
        url: `${ORIGIN}/`,
        logo: {
          "@type": "ImageObject",
          url: `${ORIGIN}/favicon-96.png`,
          width: 96,
          height: 96
        }
      },
      {
        "@type": page.article ? "Article" : "WebPage",
        "@id": `${url}#page`,
        url,
        name: page.title,
        headline: page.h1,
        description: page.description,
        inLanguage: "en",
        dateModified: UPDATED,
        image: `${ORIGIN}/assets/workscout-og.png`,
        isPartOf: { "@id": `${ORIGIN}/#website` },
        publisher: { "@id": `${ORIGIN}/#organization` },
        ...(page.article ? { datePublished: UPDATED, author: { "@id": `${ORIGIN}/#organization` } } : {})
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: breadcrumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.item
        }))
      }
    ]
  };

  const sectionHtml = page.sections.map(([heading, paragraphs]) => `
    <section class="content-section">
      <h2>${esc(heading)}</h2>
      ${paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("\n")}
    </section>
  `).join("\n");

  const relatedHtml = page.related.map(([href, label]) =>
    `<a class="related-card" href="${href}">${esc(label)} <span aria-hidden="true">→</span></a>`
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
  <meta name="theme-color" content="#f6f7f2" />
  <link rel="canonical" href="${url}" />
  <link rel="icon" href="/favicon-96.png" sizes="96x96" type="image/png" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="stylesheet" href="/seo.css" />
  <meta property="og:type" content="${page.article ? "article" : "website"}" />
  <meta property="og:site_name" content="WorkScout" />
  <meta property="og:title" content="${esc(page.title)}" />
  <meta property="og:description" content="${esc(page.description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${ORIGIN}/assets/workscout-og.png" />
  <meta property="og:image:alt" content="WorkScout remote work discovery interface" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(page.title)}" />
  <meta name="twitter:description" content="${esc(page.description)}" />
  <meta name="twitter:image" content="${ORIGIN}/assets/workscout-og.png" />
  <script type="application/ld+json">${json(graph)}</script>
</head>
<body>
  <header class="seo-header">
    <nav aria-label="Primary">${nav}</nav>
  </header>
  <main>
    <article class="seo-article">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a><span>›</span>${page.slug.startsWith("guides/") ? '<a href="/guides/">Guides</a><span>›</span>' : ""}<span>${esc(page.h1)}</span>
      </nav>
      <span class="eyebrow">${esc(page.eyebrow)}</span>
      <h1>${esc(page.h1)}</h1>
      <p class="lede">${esc(page.intro)}</p>
      <div class="hero-actions">
        <a class="primary" href="/?q=${encodeURIComponent(page.ctaQuery)}">Search WorkScout</a>
        <a class="secondary" href="/#how-it-works">How WorkScout works</a>
      </div>
      ${sectionHtml}
      <section class="related">
        <h2>Keep exploring</h2>
        <div class="related-grid">${relatedHtml}</div>
      </section>
    </article>
  </main>
  <footer class="seo-footer">
    <div><strong>WorkScout</strong><p>Remote jobs + direct hiring leads, with eligibility and source evidence upfront.</p></div>
    <nav aria-label="Footer">${nav}</nav>
  </footer>
</body>
</html>`;
}

for (const page of pages) {
  const directory = path.join(out, ...page.slug.split("/"));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), render(page));
}

const urls = ["/", ...pages.map((page) => `/${page.slug}/`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((pathname) => `  <url>
    <loc>${ORIGIN}${pathname}</loc>
    <lastmod>${UPDATED}</lastmod>
  </url>`).join("\n")}
</urlset>
`;
await fs.writeFile(path.join(out, "sitemap.xml"), sitemap);

await fs.writeFile(path.join(out, "robots.txt"), `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${ORIGIN}/sitemap.xml
`);

await fs.writeFile(path.join(out, "llms.txt"), `# WorkScout

> WorkScout is a remote-work discovery web app that searches formal job feeds and direct hiring leads, then ranks opportunities by skills, location eligibility, flexibility and freshness while preserving the original source.

## Core pages
- ${ORIGIN}/ — interactive WorkScout search
- ${ORIGIN}/remote-work/ — overview of WorkScout remote-work discovery
- ${ORIGIN}/freelance-work/ — freelance and contract work discovery
- ${ORIGIN}/remote-jobs-new-zealand/ — remote work that may be available from New Zealand
- ${ORIGIN}/direct-hiring-leads/ — direct hiring lead discovery

## Guides
- ${ORIGIN}/guides/ — guide index
- ${ORIGIN}/guides/how-to-find-remote-work/
- ${ORIGIN}/guides/remote-work-location-restrictions/
- ${ORIGIN}/guides/remote-job-scams/

## Product behavior
WorkScout keeps source URLs visible. Eligibility is presented as likely eligible, uncertain or restricted rather than guaranteed. Scout Watch can monitor saved searches, and Apply Pipeline tracks follow-up stages.

## API
Public API endpoints are implementation details and are excluded from crawling via robots.txt.
`);

console.log(`Generated ${pages.length} SEO pages + sitemap/robots/llms.txt`);
