import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const origin = "https://workscout.nzs.workers.dev";

const pages = [
  "remote-work",
  "freelance-work",
  "remote-jobs-new-zealand",
  "direct-hiring-leads",
  "guides",
  "guides/how-to-find-remote-work",
  "guides/remote-work-location-restrictions",
  "guides/remote-job-scams",
];

describe("SEO surface", () => {
  it("gives the homepage canonical metadata and crawlable internal links", async () => {
    const html = await readFile("index.html", "utf8");

    expect(html).toContain('<link rel="canonical" href="https://workscout.nzs.workers.dev/"');
    expect(html).toContain('name="robots"');
    expect(html).toContain('"@type": "WebSite"');
    expect(html).toContain('href="/remote-work/"');
    expect(html).toContain('href="/guides/how-to-find-remote-work/"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("keeps every SEO landing page independently indexable", async () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();

    for (const slug of pages) {
      const html = await readFile(`public/${slug}/index.html`, "utf8");
      const title = html.match(/<title>(.*?)<\/title>/)?.[1];
      const description = html.match(/<meta name="description" content="(.*?)"/)?.[1];

      expect(title, slug).toBeTruthy();
      expect(description, slug).toBeTruthy();
      expect(title?.length, slug).toBeGreaterThanOrEqual(30);
      expect(title?.length, slug).toBeLessThanOrEqual(65);
      expect(description?.length, slug).toBeGreaterThanOrEqual(100);
      expect(description?.length, slug).toBeLessThanOrEqual(165);
      expect(html, slug).toContain(`<link rel="canonical" href="${origin}/${slug}/"`);
      expect(html, slug).toContain("<h1>");
      expect(html, slug).toContain('"@graph"');
      expect(html, slug).toContain('"BreadcrumbList"');
      expect(html, slug).toContain('name="robots" content="index,follow');

      const structuredData = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
      expect(structuredData, slug).toBeTruthy();
      expect(() => JSON.parse(structuredData || "")).not.toThrow();

      if (title) titles.add(title);
      if (description) descriptions.add(description);
    }

    expect(titles.size).toBe(pages.length);
    expect(descriptions.size).toBe(pages.length);
  });

  it("publishes a focused sitemap, blocks API crawling, and has a real noindex 404", async () => {
    const sitemap = await readFile("public/sitemap.xml", "utf8");
    const robots = await readFile("public/robots.txt", "utf8");
    const notFound = await readFile("public/404.html", "utf8");
    const wrangler = await readFile("wrangler.jsonc", "utf8");

    expect((sitemap.match(/<url>/g) || []).length).toBe(pages.length + 1);
    for (const slug of pages) {
      expect(sitemap).toContain(`<loc>${origin}/${slug}/</loc>`);
    }
    expect(sitemap).not.toContain("/api/");
    expect(sitemap).not.toContain("404");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`);
    expect(notFound).toContain('name="robots" content="noindex,follow"');
    expect(wrangler).toContain('"not_found_handling": "404-page"');
    expect(wrangler).toContain('"html_handling": "auto-trailing-slash"');
  });
});
