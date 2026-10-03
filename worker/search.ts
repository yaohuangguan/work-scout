export type Eligibility = "eligible" | "uncertain" | "restricted";

export interface SearchPreferences {
  raw: string;
  countryCode: string;
  countryLabel: string;
  hoursPerWeek: number;
  workTypes: string[];
}

export interface WorkItem {
  id: string;
  title: string;
  company: string;
  summary: string;
  source: string;
  sourceUrl: string;
  applyUrl: string;
  postedAt: string | null;
  type: string;
  location: string;
  salary: string | null;
  tags: string[];
  eligibility: Eligibility;
  eligibilityText: string;
  score: number;
  why: string[];
  kind: "Job" | "Contract" | "Gig" | "Lead";
}

export interface QueryPlan {
  terms: string[];
  queries: string[];
}

const skillRules: Array<[RegExp, string[]]> = [
  [/react/i, ["react", "frontend"]],
  [/node|node\.js/i, ["node", "javascript"]],
  [/java|spring/i, ["java", "spring"]],
  [/ai\s*automation|automation|自动化/i, ["automation", "ai"]],
  [/客服|customer\s*support|support/i, ["customer support"]],
  [/excel|spreadsheet|表格|数据整理|data\s*entry/i, ["data entry", "excel"]],
  [/剪辑|video\s*(edit|editing)|短视频/i, ["video editor"]],
  [/设计|designer?|figma/i, ["design"]],
  [/翻译|translation|translator/i, ["translation"]],
  [/写作|writer|writing|copywriting/i, ["writing"]],
  [/销售|sales/i, ["sales"]],
  [/营销|marketing|growth/i, ["marketing"]],
  [/virtual\s*assistant|\bva\b|行政|助理/i, ["virtual assistant"]],
  [/wordpress|shopify|网站维护|website\s*maintenance/i, ["website maintenance"]],
];

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const lower = (value: unknown) => clean(value).toLowerCase();

const unique = <T,>(items: T[]) => [...new Set(items)];

export function planQuery(raw: string): QueryPlan {
  const terms: string[] = [];
  for (const [pattern, additions] of skillRules) {
    if (pattern.test(raw)) terms.push(...additions);
  }

  const englishTokens = raw
    .toLowerCase()
    .match(/[a-z][a-z0-9.+#-]{1,24}/g)
    ?.filter((token) => !["with", "work", "remote", "hours", "week", "looking", "open", "from", "that", "this", "have"].includes(token)) ?? [];

  terms.push(...englishTokens);
  const deduped = unique(terms).slice(0, 10);
  const queries = unique(
    deduped
      .filter((term) => term.length >= 2)
      .slice(0, 5)
  );

  return {
    terms: deduped.length ? deduped : ["remote"],
    queries: queries.length ? queries : ["remote"],
  };
}

const countryAliases: Record<string, string[]> = {
  NZ: ["new zealand", "nz", "aotearoa", "oceania", "apac", "asia pacific"],
  AU: ["australia", "au", "oceania", "apac", "asia pacific"],
  US: ["united states", "usa", "u.s.", "us", "north america"],
  CA: ["canada", "ca", "north america"],
  GB: ["united kingdom", "uk", "great britain", "gb", "europe", "emea"],
};

function inferEligibility(locationText: string, countryCode: string, explicitRestrictions = false): {
  eligibility: Eligibility;
  text: string;
} {
  const text = lower(locationText);
  if (!text || /worldwide|anywhere|global|all countries|remote -? international/.test(text)) {
    return { eligibility: "eligible", text: "Worldwide / no location restriction found" };
  }

  const aliases = countryAliases[countryCode] ?? [countryCode.toLowerCase()];
  if (aliases.some((alias) => text.includes(alias.toLowerCase()))) {
    return { eligibility: "eligible", text: `Accepts ${countryCode} / your region` };
  }

  const restrictive = /only|must be|based in|required location|americas|europe|emea|united states|usa|canada|latam/.test(text);
  if (explicitRestrictions || restrictive) {
    return { eligibility: "restricted", text: `Location restriction: ${clean(locationText)}` };
  }

  return { eligibility: "uncertain", text: `Check location requirement: ${clean(locationText)}` };
}

function mapKind(type: string, source: string): WorkItem["kind"] {
  const value = lower(type);
  if (/contract|freelance/.test(value)) return "Contract";
  if (/part.?time|temporary|gig/.test(value)) return "Gig";
  if (source === "WorkScout") return "Lead";
  return "Job";
}

function formatSalary(min?: number | null, max?: number | null, currency?: string, fallback?: string | null) {
  if (fallback && clean(fallback)) return clean(fallback);
  if (!min && !max) return null;
  const cur = currency || "USD";
  const fmt = (n?: number | null) => (n ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) : null);
  if (min && max) return `${cur} ${fmt(min)}–${fmt(max)}`;
  return `${cur} ${fmt(min || max)}`;
}

export function scoreWork(item: Omit<WorkItem, "score" | "why">, prefs: SearchPreferences, terms: string[]) {
  const haystack = lower([item.title, item.company, item.summary, item.tags.join(" "), item.type].join(" "));
  const matched = terms.filter((term) => haystack.includes(term.toLowerCase()));
  let score = Math.min(54, matched.length * 12);

  if (item.eligibility === "eligible") score += 24;
  if (item.eligibility === "uncertain") score += 8;
  if (item.eligibility === "restricted") score -= 35;
  if (item.kind === "Lead") score += 14;
  if (item.source === "HN Freelance") score += 5;

  const type = lower(item.type);
  const wanted = prefs.workTypes.map((v) => v.toLowerCase());
  if (wanted.some((v) => type.includes(v) || (v === "gig" && /temporary|freelance/.test(type)))) score += 12;

  if (prefs.hoursPerWeek <= 25) {
    if (/part.?time|contract|freelance|temporary/.test(type)) score += 12;
    if (/full.?time/.test(type)) score -= 8;
  }

  if (item.postedAt) {
    const ageDays = (Date.now() - new Date(item.postedAt).getTime()) / 86_400_000;
    if (ageDays <= 2) score += 10;
    else if (ageDays <= 7) score += 6;
    else if (ageDays <= 30) score += 2;
  }

  const why: string[] = [];
  if (matched.length) why.push(`Matches ${matched.slice(0, 3).join(", ")}`);
  if (item.eligibility === "eligible") why.push(item.eligibilityText);
  if (prefs.hoursPerWeek <= 25 && /part.?time|contract|freelance|temporary/.test(type)) {
    why.push(`Fits a ≤${prefs.hoursPerWeek}h/week search better`);
  }
  if (item.postedAt) {
    const ageDays = Math.max(0, Math.floor((Date.now() - new Date(item.postedAt).getTime()) / 86_400_000));
    if (ageDays <= 7) why.push(ageDays === 0 ? "Posted today" : `Posted ${ageDays}d ago`);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    why: why.slice(0, 3),
  };
}

async function getJson(url: string, cacheTtl = 300) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "WorkScout/0.2" },
    signal: AbortSignal.timeout(8_000),
    cf: { cacheTtl, cacheEverything: true },
  } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<any>;
}

async function getText(url: string, cacheTtl = 180) {
  const response = await fetch(url, {
    headers: { Accept: "application/atom+xml,text/xml;q=0.9,*/*;q=0.8", "User-Agent": "WorkScout/0.2 (remote work discovery)" },
    signal: AbortSignal.timeout(8_000),
    cf: { cacheTtl, cacheEverything: true },
  } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function decodeXml(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function finalize(base: Omit<WorkItem, "score" | "why">, prefs: SearchPreferences, terms: string[]): WorkItem {
  return { ...base, ...scoreWork(base, prefs, terms) };
}

async function fetchHimalayas(prefs: SearchPreferences, plan: QueryPlan): Promise<WorkItem[]> {
  const batches = await Promise.all(
    plan.queries.slice(0, 4).map(async (q) => {
      const url = new URL("https://himalayas.app/jobs/api/search");
      url.searchParams.set("q", q);
      url.searchParams.set("sort", "recent");
      url.searchParams.set("page", "1");
      if (prefs.countryCode && prefs.countryCode !== "ANY") url.searchParams.set("country", prefs.countryCode);
      const data = await getJson(url.toString());
      return Array.isArray(data.jobs) ? data.jobs : [];
    })
  );

  return batches.flat().map((job: any) => {
    const restrictions = Array.isArray(job.locationRestrictions) ? job.locationRestrictions.join(", ") : "";
    const tz = Array.isArray(job.timezoneRestriction) ? job.timezoneRestriction.join(", ") : "";
    const location = [restrictions, tz && `Timezone ${tz}`].filter(Boolean).join(" · ") || "Worldwide";
    const e = inferEligibility(restrictions, prefs.countryCode, Boolean(restrictions));
    const type = clean(job.employmentType || "Remote");
    return finalize({
      id: `himalayas:${job.guid || job.applicationLink || job.title}`,
      title: clean(job.title),
      company: clean(job.companyName || "Unknown company"),
      summary: clean(job.excerpt || job.description).slice(0, 420),
      source: "Himalayas",
      sourceUrl: clean(job.guid || job.applicationLink || "https://himalayas.app/jobs"),
      applyUrl: clean(job.applicationLink || job.guid || "https://himalayas.app/jobs"),
      postedAt: job.pubDate || null,
      type,
      location,
      salary: formatSalary(job.minSalary, job.maxSalary, job.currency),
      tags: [...(job.category || []), ...(job.parentCategories || [])].map(clean).filter(Boolean),
      eligibility: e.eligibility,
      eligibilityText: e.text,
      kind: mapKind(type, "Himalayas"),
    }, prefs, plan.terms);
  });
}

async function fetchRemoteOk(prefs: SearchPreferences, plan: QueryPlan): Promise<WorkItem[]> {
  const data = await getJson("https://remoteok.com/api");
  const jobs = Array.isArray(data) ? data.filter((row: any) => row && (row.position || row.company)) : [];
  const queryTerms = plan.terms.map((t) => t.toLowerCase());

  return jobs
    .filter((job: any) => {
      const haystack = lower([job.position, job.company, job.description, ...(job.tags || [])].join(" "));
      return queryTerms.some((term) => haystack.includes(term));
    })
    .slice(0, 80)
    .map((job: any) => {
      const location = clean(job.location || "Worldwide");
      const e = inferEligibility(location, prefs.countryCode);
      const tags = (job.tags || []).map(clean).filter(Boolean);
      const type = tags.find((tag: string) => /contract|part.?time|full.?time|freelance/.test(tag.toLowerCase())) || "Remote";
      return finalize({
        id: `remoteok:${job.id || job.url || job.position}`,
        title: clean(job.position),
        company: clean(job.company || "Unknown company"),
        summary: clean(job.description).slice(0, 420),
        source: "Remote OK",
        sourceUrl: clean(job.url || "https://remoteok.com"),
        applyUrl: clean(job.apply_url || job.url || "https://remoteok.com"),
        postedAt: job.date || (job.epoch ? new Date(job.epoch * 1000).toISOString() : null),
        type,
        location,
        salary: formatSalary(job.salary_min, job.salary_max, "USD"),
        tags,
        eligibility: e.eligibility,
        eligibilityText: e.text,
        kind: mapKind(type, "Remote OK"),
      }, prefs, plan.terms);
    });
}

async function fetchRemotive(prefs: SearchPreferences, plan: QueryPlan): Promise<WorkItem[]> {
  const batches = await Promise.all(
    plan.queries.slice(0, 3).map(async (q) => {
      const url = new URL("https://remotive.com/api/remote-jobs");
      url.searchParams.set("search", q);
      const data = await getJson(url.toString());
      return Array.isArray(data.jobs) ? data.jobs : [];
    })
  );

  return batches.flat().map((job: any) => {
    const location = clean(job.candidate_required_location || "Worldwide");
    const e = inferEligibility(location, prefs.countryCode);
    const type = clean(job.job_type || "Remote");
    return finalize({
      id: `remotive:${job.id || job.url || job.title}`,
      title: clean(job.title),
      company: clean(job.company_name || "Unknown company"),
      summary: clean(job.description).slice(0, 420),
      source: "Remotive",
      sourceUrl: clean(job.url || "https://remotive.com/remote-jobs"),
      applyUrl: clean(job.url || "https://remotive.com/remote-jobs"),
      postedAt: job.publication_date || null,
      type,
      location,
      salary: formatSalary(null, null, "", job.salary),
      tags: [job.category, ...(job.tags || [])].map(clean).filter(Boolean),
      eligibility: e.eligibility,
      eligibilityText: e.text,
      kind: mapKind(type, "Remotive"),
    }, prefs, plan.terms);
  });
}

function extractLeadLocation(text: string) {
  const compact = clean(text).slice(0, 260);
  if (/remote\s*(worldwide|anywhere)|worldwide\s*remote/i.test(compact)) return "Worldwide";
  const paren = compact.match(/remote\s*\(([^)]+)\)/i);
  if (paren) return `Remote (${paren[1].trim()})`;
  const pipe = compact.match(/seeking freelancer\s*\|\s*([^|]{2,80})/i);
  if (pipe) return clean(pipe[1]);
  const location = compact.match(/location\s*:\s*([^|;]{2,80})/i);
  if (location) return clean(location[1]);
  if (/\bremote\b/i.test(compact)) return "Remote · check details";
  return "Check post";
}

async function fetchRedditForHire(prefs: SearchPreferences, plan: QueryPlan): Promise<WorkItem[]> {
  const xml = await getText("https://www.reddit.com/r/forhire/new/.rss", 180);
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) => match[1]);
  const queryTerms = plan.terms.map((term) => term.toLowerCase());

  const readTag = (entry: string, tag: string) => {
    const match = entry.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return match ? decodeXml(match[1]) : "";
  };

  return entries
    .map((entry) => {
      const title = clean(readTag(entry, "title"));
      const content = clean(decodeXml(readTag(entry, "content")));
      const link = decodeXml(entry.match(/<link\s+href="([^"]+)"/i)?.[1] || "");
      const author = clean(readTag(entry, "name")).replace(/^\/u\//, "");
      const updated = clean(readTag(entry, "updated"));
      return { title, content, link, author, updated };
    })
    .filter((entry) => /^\[hiring\]/i.test(entry.title))
    .filter((entry) => {
      const haystack = lower(`${entry.title} ${entry.content}`);
      return queryTerms.some((term) => haystack.includes(term));
    })
    .slice(0, 40)
    .map((entry) => {
      const haystack = lower(`${entry.title} ${entry.content}`);
      const matched = plan.terms.filter((term) => haystack.includes(term.toLowerCase())).slice(0, 5);
      const location = extractLeadLocation(`${entry.title} ${entry.content}`);
      const e = inferEligibility(location, prefs.countryCode);
      const salary = entry.content.match(/(?:USD|NZD|AUD|CAD|£|€|\$)\s?\d[\d,.]*(?:\s*(?:-|–|to)\s*(?:[$£€])?\d[\d,.]*)?(?:\s*(?:\/hr|per hour|fixed))?/i)?.[0] || null;

      return finalize({
        id: `reddit-forhire:${entry.link || entry.title}`,
        title: clean(entry.title.replace(/^\[hiring\]\s*/i, "")),
        company: entry.author ? `Reddit u/${entry.author}` : "Reddit poster",
        summary: entry.content.slice(0, 520),
        source: "Reddit r/forhire",
        sourceUrl: entry.link,
        applyUrl: entry.link,
        postedAt: entry.updated || null,
        type: "Freelance / Gig",
        location,
        salary,
        tags: unique(["Direct lead", "Freelance", ...matched]),
        eligibility: e.eligibility,
        eligibilityText: e.text,
        kind: "Lead",
      }, prefs, plan.terms);
    });
}

async function fetchHnFreelance(prefs: SearchPreferences, plan: QueryPlan): Promise<WorkItem[]> {
  const since = Math.floor(Date.now() / 1000) - 120 * 86_400;
  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("query", "SEEKING FREELANCER");
  url.searchParams.set("tags", "comment");
  url.searchParams.set("numericFilters", `created_at_i>${since}`);
  url.searchParams.set("hitsPerPage", "100");

  const data = await getJson(url.toString(), 600);
  const hits = Array.isArray(data.hits) ? data.hits : [];
  const queryTerms = plan.terms.map((term) => term.toLowerCase());

  return hits
    .filter((hit: any) => /freelancer\? seeking freelancer\?/i.test(String(hit.story_title || "")))
    .filter((hit: any) => /seeking freelancer/i.test(clean(hit.comment_text || "")))
    .filter((hit: any) => {
      const body = lower(hit.comment_text || "");
      return queryTerms.some((term) => body.includes(term));
    })
    .slice(0, 40)
    .map((hit: any) => {
      const body = clean(hit.comment_text || "");
      const matched = plan.terms.filter((term) => lower(body).includes(term.toLowerCase())).slice(0, 5);
      const location = extractLeadLocation(body);
      const e = inferEligibility(location, prefs.countryCode);
      const author = clean(hit.author || "HN poster");
      const title = matched.length
        ? `Freelance help wanted: ${matched.slice(0, 2).join(" / ")}`
        : "Freelance help wanted";
      const itemUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;

      return finalize({
        id: `hn-freelance:${hit.objectID}`,
        title,
        company: `HN @${author}`,
        summary: body.replace(/^SEEKING FREELANCER\s*[:|—-]?\s*/i, "").slice(0, 520),
        source: "HN Freelance",
        sourceUrl: itemUrl,
        applyUrl: itemUrl,
        postedAt: hit.created_at || null,
        type: "Freelance / Contract",
        location,
        salary: null,
        tags: unique(["Direct lead", "Freelance", ...matched]),
        eligibility: e.eligibility,
        eligibilityText: e.text,
        kind: "Lead",
      }, prefs, plan.terms);
    });
}

export function dedupeWorkItems(items: WorkItem[]) {
  const seen = new Map<string, WorkItem>();
  for (const item of items) {
    const key = `${lower(item.company)}::${lower(item.title).replace(/[^a-z0-9]+/g, " ")}`;
    const current = seen.get(key);
    if (!current || item.score > current.score) seen.set(key, item);
  }
  return [...seen.values()];
}

export async function searchExternal(prefs: SearchPreferences) {
  const plan = planQuery(prefs.raw);
  const sources = [
    ["Reddit r/forhire", () => fetchRedditForHire(prefs, plan)],
    ["HN Freelance", () => fetchHnFreelance(prefs, plan)],
    ["Himalayas", () => fetchHimalayas(prefs, plan)],
    ["Remote OK", () => fetchRemoteOk(prefs, plan)],
    ["Remotive", () => fetchRemotive(prefs, plan)],
  ] as const;

  const settled = await Promise.all(
    sources.map(async ([name, run]) => {
      try {
        const items = await run();
        return { name, ok: true as const, items, error: null };
      } catch (error) {
        return { name, ok: false as const, items: [] as WorkItem[], error: error instanceof Error ? error.message : String(error) };
      }
    })
  );

  const items = dedupeWorkItems(settled.flatMap((s) => s.items))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  return {
    plan,
    items,
    sources: settled.map((s) => ({ name: s.name, ok: s.ok, count: s.items.length, error: s.error })),
  };
}

export function communityRowToItem(row: any, prefs: SearchPreferences, terms: string[]): WorkItem {
  const location = clean(row.location_scope || "Worldwide");
  const e = inferEligibility(location, prefs.countryCode);
  const type = clean(row.work_type || "Contract");
  return finalize({
    id: `community:${row.id}`,
    title: clean(row.title),
    company: clean(row.company || "Independent"),
    summary: clean(row.description).slice(0, 420),
    source: "WorkScout",
    sourceUrl: "#",
    applyUrl: String(row.contact || "").includes("@") && !String(row.contact).startsWith("http")
      ? `mailto:${String(row.contact).trim()}`
      : clean(row.contact),
    postedAt: row.created_at || null,
    type,
    location,
    salary: clean(row.budget) || null,
    tags: String(row.skills || "").split(",").map(clean).filter(Boolean),
    eligibility: e.eligibility,
    eligibilityText: e.text,
    kind: "Lead",
  }, prefs, terms);
}
