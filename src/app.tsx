import { FormEvent, useEffect, useMemo, useState } from "react";

type Eligibility = "eligible" | "uncertain" | "restricted";
type View = "explore" | "saved";
type Mode = "all" | "leads" | "eligible" | "flexible";
type Freshness = "all" | "7" | "30";

type WorkItem = {
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
};

type SearchResponse = {
  count: number;
  plan: { terms: string[]; queries: string[] };
  items: WorkItem[];
  sources: Array<{ name: string; ok: boolean; count: number; error?: string | null }>;
};

type RecentSearch = {
  query: string;
  country: string;
  hours: number;
  types: string[];
};

const typeOptions = [
  ["contract", "Contract"],
  ["part-time", "Part-time"],
  ["gig", "Gig"],
  ["full-time", "Full-time"],
] as const;

const examples = [
  "Customer support, Chinese + English",
  "Video editing for short-form content",
  "React + Node, 20h/week",
  "Excel / data entry evenings",
  "AI automation + website maintenance",
];

const STORAGE = {
  saved: "workscout:saved:v1",
  recent: "workscout:recent:v1",
};

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

const countryNames: Record<string, string> = {
  ANY: "Anywhere / not sure",
  NZ: "New Zealand",
  AU: "Australia",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
};

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function relativeDate(value: string | null) {
  if (!value) return "Date not listed";
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return "Date not listed";
  const diff = Math.max(0, Date.now() - parsed);
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 31) return `${days} days ago`;
  return new Date(value).toLocaleDateString();
}

function ageDays(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - parsed) / 86_400_000);
}

function eligibilityLabel(value: Eligibility) {
  if (value === "eligible") return "Looks eligible";
  if (value === "restricted") return "Likely restricted";
  return "Check location";
}

function sourceLabel(item: WorkItem) {
  if (item.source === "WorkScout") return "Community post";
  if (item.kind === "Lead") return "Direct hiring lead";
  return "Original job listing";
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden><path d="m21 21-4.35-4.35m2.35-5.15A7.5 7.5 0 1 1 4 11.5a7.5 7.5 0 0 1 15 0Z" /></svg>;
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return <svg viewBox="0 0 24 24" aria-hidden><path className={filled ? "filled-path" : ""} d="M6.5 4.5A2.5 2.5 0 0 1 9 2h6a2.5 2.5 0 0 1 2.5 2.5V22L12 18.4 6.5 22V4.5Z" /></svg>;
}

function WorkCard({
  item,
  saved,
  onToggleSave,
  onOpen,
}: {
  item: WorkItem;
  saved: boolean;
  onToggleSave: (item: WorkItem) => void;
  onOpen: (item: WorkItem) => void;
}) {
  return (
    <article className={`work-card ${item.kind === "Lead" ? "lead-card" : ""}`}>
      <div className="card-topline">
        <div className="source-row">
          <span className={`kind-pill ${item.kind === "Lead" ? "lead" : ""}`}>{item.kind}</span>
          <span className="source-name">{item.source}</span>
          <span className="dot">•</span>
          <span>{relativeDate(item.postedAt)}</span>
        </div>
        <div className="card-tools">
          <span className="match-score">{item.score}% fit</span>
          <button className={`save-button ${saved ? "saved" : ""}`} onClick={() => onToggleSave(item)} aria-label={saved ? "Remove from saved" : "Save opportunity"}>
            <BookmarkIcon filled={saved} />
          </button>
        </div>
      </div>

      <div className="card-heading">
        <div>
          <button className="title-button" onClick={() => onOpen(item)}><h3>{item.title}</h3></button>
          <p className="company">{item.company}</p>
        </div>
        <span className={`eligibility ${item.eligibility}`}>{eligibilityLabel(item.eligibility)}</span>
      </div>

      <div className="meta-row">
        <span>{item.type}</span>
        <span>{item.location}</span>
        {item.salary && <span>{item.salary}</span>}
      </div>

      <p className="summary">{item.summary || "No description preview available."}</p>

      {item.why.length > 0 && (
        <div className="why-box">
          <strong>Why this surfaced</strong>
          <div className="why-list">
            {item.why.map((reason) => <span key={reason}>✓ {reason}</span>)}
          </div>
        </div>
      )}

      <div className="tag-row">
        {item.tags.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}
      </div>

      <div className="card-actions">
        <button className="detail-button" onClick={() => onOpen(item)}>View details</button>
        <a className="primary-link" href={item.applyUrl} target="_blank" rel="noreferrer">
          {item.kind === "Lead" ? "Open lead" : "Open original"} <span aria-hidden>↗</span>
        </a>
      </div>
    </article>
  );
}

function DetailModal({
  item,
  saved,
  onClose,
  onToggleSave,
}: {
  item: WorkItem;
  saved: boolean;
  onClose: () => void;
  onToggleSave: (item: WorkItem) => void;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <article className="detail-modal">
        <div className="modal-head detail-head">
          <div>
            <div className="source-row">
              <span className={`kind-pill ${item.kind === "Lead" ? "lead" : ""}`}>{item.kind}</span>
              <span>{sourceLabel(item)}</span>
              <span className="dot">•</span>
              <span>{relativeDate(item.postedAt)}</span>
            </div>
            <h2>{item.title}</h2>
            <p className="detail-company">{item.company}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="detail-stats">
          <div><span>Fit</span><strong>{item.score}%</strong></div>
          <div><span>Location</span><strong>{item.location}</strong></div>
          <div><span>Type</span><strong>{item.type}</strong></div>
          <div><span>Eligibility</span><strong>{eligibilityLabel(item.eligibility)}</strong></div>
        </div>

        <section className="detail-section">
          <h3>Opportunity</h3>
          <p>{item.summary || "No description preview available."}</p>
        </section>

        <section className="detail-section">
          <h3>Why WorkScout surfaced it</h3>
          <div className="detail-reasons">
            {item.why.length ? item.why.map((reason) => <span key={reason}>✓ {reason}</span>) : <span>Matched your current search.</span>}
            <span>ⓘ {item.eligibilityText}</span>
          </div>
        </section>

        {item.tags.length > 0 && (
          <section className="detail-section">
            <h3>Signals</h3>
            <div className="tag-row">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          </section>
        )}

        <div className="detail-actions">
          <button className={`secondary-button save-wide ${saved ? "is-saved" : ""}`} onClick={() => onToggleSave(item)}>
            <BookmarkIcon filled={saved} /> {saved ? "Saved" : "Save for later"}
          </button>
          <a className="primary-link large" href={item.applyUrl} target="_blank" rel="noreferrer">
            {item.kind === "Lead" ? "Open direct lead" : "Open original listing"} <span aria-hidden>↗</span>
          </a>
        </div>
      </article>
    </div>
  );
}

function PostModal({ onClose, onPosted }: { onClose: () => void; onPosted: (query: string) => void }) {
  const [form, setForm] = useState({
    title: "",
    company: "",
    description: "",
    skills: "",
    workType: "Contract",
    locationScope: "Worldwide",
    budget: "",
    contact: "",
    website: "",
  });
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    setError("");
    const response = await fetch(apiUrl("/api/posts"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) {
      setState("idle");
      setError(data.error || "Could not publish this work.");
      return;
    }
    setState("done");
    onPosted(form.skills || form.title);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <span className="eyebrow">Community lead</span>
            <h2>Post a piece of remote work</h2>
            <p>No account required in this first release. Add a direct contact method and the work becomes searchable immediately.</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </div>

        {state === "done" ? (
          <div className="success-state">
            <div className="success-icon">✓</div>
            <h3>Published and searchable</h3>
            <p>Your post is now part of the same result pool as external work.</p>
            <button className="primary-button" onClick={onClose}>See results</button>
          </div>
        ) : (
          <form className="post-form" onSubmit={submit}>
            <label>
              What do you need?
              <input required minLength={3} maxLength={120} placeholder="e.g. Fix a Shopify checkout flow" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <div className="form-grid">
              <label>
                Company / name
                <input placeholder="Optional" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </label>
              <label>
                Work type
                <select value={form.workType} onChange={(e) => setForm({ ...form, workType: e.target.value })}>
                  <option>Contract</option>
                  <option>Part-time</option>
                  <option>Gig</option>
                  <option>Full-time</option>
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea required minLength={20} maxLength={3000} rows={5} placeholder="Scope, expected outcome, timing, and anything a worker should know." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="form-grid">
              <label>
                Skills
                <input placeholder="React, Shopify, customer support..." value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
              </label>
              <label>
                Remote scope
                <input placeholder="Worldwide / NZ / APAC..." value={form.locationScope} onChange={(e) => setForm({ ...form, locationScope: e.target.value })} />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Budget
                <input placeholder="e.g. NZD 800 fixed" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </label>
              <label>
                Contact
                <input required placeholder="Email or application URL" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </label>
            </div>
            <label className="honeypot" aria-hidden="true">
              Website
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </label>
            {error && <div className="form-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              <button className="primary-button" disabled={state === "saving"}>{state === "saving" ? "Publishing…" : "Publish work"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("ANY");
  const [hours, setHours] = useState(20);
  const [types, setTypes] = useState<string[]>(["contract", "part-time", "gig"]);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [freshness, setFreshness] = useState<Freshness>("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [view, setView] = useState<View>("explore");
  const [showPost, setShowPost] = useState(false);
  const [detail, setDetail] = useState<WorkItem | null>(null);
  const [saved, setSaved] = useState<WorkItem[]>(() => readStored(STORAGE.saved, []));
  const [recent, setRecent] = useState<RecentSearch[]>(() => readStored(STORAGE.recent, []));

  useEffect(() => {
    fetch(apiUrl("/api/meta"))
      .then((response) => response.ok
        ? response.json() as Promise<{ country?: string }>
        : null)
      .then((meta) => {
        if (meta?.country && countryNames[meta.country]) setCountry(meta.country);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE.saved, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    localStorage.setItem(STORAGE.recent, JSON.stringify(recent));
  }, [recent]);

  async function runSearch(nextQuery = query, overrides?: Partial<RecentSearch>) {
    const finalQuery = (overrides?.query ?? nextQuery).trim();
    if (!finalQuery) return;
    const finalCountry = overrides?.country ?? country;
    const finalHours = overrides?.hours ?? hours;
    const finalTypes = overrides?.types ?? types;

    setLoading(true);
    setSearchError("");
    setView("explore");
    const params = new URLSearchParams({
      q: finalQuery,
      country: finalCountry,
      countryLabel: countryNames[finalCountry] || finalCountry,
      hours: String(finalHours),
      types: finalTypes.join(","),
    });

    try {
      const response = await fetch(apiUrl(`/api/search?${params}`));
      if (!response.ok) throw new Error("Search failed");
      const body = await response.json() as SearchResponse;
      setData(body);
      setSearched(finalQuery);
      setQuery(finalQuery);
      setCountry(finalCountry);
      setHours(finalHours);
      setTypes(finalTypes);
      setSourceFilter("all");

      const entry: RecentSearch = { query: finalQuery, country: finalCountry, hours: finalHours, types: finalTypes };
      setRecent((current) => {
        const withoutDuplicate = current.filter((item) =>
          !(item.query === entry.query && item.country === entry.country && item.hours === entry.hours && item.types.join(",") === entry.types.join(","))
        );
        return [entry, ...withoutDuplicate].slice(0, 6);
      });
    } catch {
      setSearchError("Search could not reach the live sources. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  const baseItems = view === "saved" ? saved : (data?.items ?? []);

  const sourceOptions = useMemo(
    () => [...new Set(baseItems.map((item) => item.source))].sort(),
    [baseItems]
  );

  const visible = useMemo(() => {
    return baseItems.filter((item) => {
      if (mode === "leads" && item.kind !== "Lead") return false;
      if (mode === "eligible" && item.eligibility !== "eligible") return false;
      if (mode === "flexible" && !(/contract|part.?time|freelance|temporary|gig/i.test(item.type) || item.kind === "Lead")) return false;
      if (freshness !== "all" && ageDays(item.postedAt) > Number(freshness)) return false;
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;
      return true;
    });
  }, [baseItems, freshness, mode, sourceFilter]);

  const stats = useMemo(() => {
    const items = data?.items ?? [];
    return {
      leads: items.filter((item) => item.kind === "Lead").length,
      eligible: items.filter((item) => item.eligibility === "eligible").length,
      fresh: items.filter((item) => ageDays(item.postedAt) <= 7).length,
    };
  }, [data]);

  function toggleType(value: string) {
    setTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function chooseExample(value: string) {
    setQuery(value);
    void runSearch(value);
  }

  function toggleSave(item: WorkItem) {
    setSaved((current) => current.some((savedItem) => savedItem.id === item.id)
      ? current.filter((savedItem) => savedItem.id !== item.id)
      : [item, ...current]);
  }

  function handlePosted(nextQuery: string) {
    if (nextQuery) setQuery(nextQuery);
    window.setTimeout(() => void runSearch(nextQuery || query), 250);
  }

  function replayRecent(item: RecentSearch) {
    void runSearch(item.query, item);
  }

  const hasSearched = Boolean(data || loading);

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand brand-button" onClick={() => setView("explore")}>
          <span className="brand-mark">W</span>
          <span>WorkScout</span>
          <span className="beta">BETA</span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}>Explore</button>
          <button className={view === "saved" ? "active" : ""} onClick={() => setView("saved")}>
            Saved <span>{saved.length}</span>
          </button>
        </nav>

        <div className="header-actions">
          <button className="secondary-button" onClick={() => setShowPost(true)}>Post work</button>
        </div>
      </header>

      <main>
        {view === "explore" && (
          <section className={`hero ${hasSearched ? "searched-hero" : ""}`}>
            <div className="hero-copy-wrap">
              <span className="eyebrow">Remote work discovery, not another job board</span>
              <h1>Find work you can <em>actually take.</em></h1>
              <p className="hero-copy">Describe what you can do. WorkScout searches job feeds and direct hiring leads, then checks location fit, flexibility, freshness, and why the opportunity matches.</p>
            </div>

            <div className="search-panel">
              <label className="search-label">What kind of work can you do?</label>
              <div className="search-row">
                <div className="search-input-wrap">
                  <SearchIcon />
                  <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={2} placeholder="Customer support, Excel, video editing, React, AI automation…" onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void runSearch();
                  }} />
                </div>
                <button className="search-button" onClick={() => void runSearch()} disabled={loading || !query.trim()}>
                  {loading ? "Searching…" : "Find work"}
                </button>
              </div>

              <div className="preference-row">
                <label>
                  Based in
                  <select value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="ANY">Anywhere / not sure</option>
                    <option value="NZ">New Zealand</option>
                    <option value="AU">Australia</option>
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                  </select>
                </label>
                <label>
                  Available
                  <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                    <option value={10}>Up to 10 h/week</option>
                    <option value={20}>Up to 20 h/week</option>
                    <option value={25}>Up to 25 h/week</option>
                    <option value={40}>Up to 40 h/week</option>
                  </select>
                </label>
                <div className="type-group">
                  <span>Open to</span>
                  <div className="type-options">
                    {typeOptions.map(([value, label]) => (
                      <button type="button" key={value} className={types.includes(value) ? "selected" : ""} onClick={() => toggleType(value)}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {searchError && <div className="search-error-banner">{searchError}</div>}

            {!hasSearched && (
              <>
                <div className="examples">
                  <span>Try:</span>
                  {examples.map((example) => <button key={example} onClick={() => chooseExample(example)}>{example}</button>)}
                </div>
                <div className="value-strip">
                  <div><strong>Direct leads</strong><span>Not only formal job listings</span></div>
                  <div><strong>Eligibility first</strong><span>See location restrictions before clicking</span></div>
                  <div><strong>Source transparent</strong><span>Every result links back to the original</span></div>
                </div>
              </>
            )}

            {recent.length > 0 && !hasSearched && (
              <div className="recent-block">
                <span className="intel-label">Recent searches on this device</span>
                <div className="recent-list">
                  {recent.map((item) => (
                    <button key={`${item.query}-${item.country}-${item.hours}`} onClick={() => replayRecent(item)}>
                      <strong>{item.query}</strong>
                      <span>{item.country} · ≤{item.hours}h/week</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {view === "explore" && hasSearched && (
          <section className="results-section">
            <div className="results-head">
              <div>
                <span className="eyebrow">Live discovery</span>
                <h2>{loading ? "Searching the web…" : `${visible.length} opportunities`}</h2>
                <p>{searched ? <>For <strong>{searched}</strong></> : "Describe what you can do to start."}</p>
              </div>
              {data && (
                <div className="result-stats">
                  <div><strong>{stats.leads}</strong><span>direct leads</span></div>
                  <div><strong>{stats.eligible}</strong><span>look eligible</span></div>
                  <div><strong>{stats.fresh}</strong><span>≤7 days old</span></div>
                </div>
              )}
            </div>

            <div className="result-toolbar">
              <div className="filter-tabs">
                <button className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>Best matches</button>
                <button className={mode === "leads" ? "active" : ""} onClick={() => setMode("leads")}>Direct leads</button>
                <button className={mode === "eligible" ? "active" : ""} onClick={() => setMode("eligible")}>Looks eligible</button>
                <button className={mode === "flexible" ? "active" : ""} onClick={() => setMode("flexible")}>Flexible</button>
              </div>
              <div className="select-filters">
                <select value={freshness} onChange={(e) => setFreshness(e.target.value as Freshness)} aria-label="Freshness">
                  <option value="all">Any date</option>
                  <option value="7">Past 7 days</option>
                  <option value="30">Past 30 days</option>
                </select>
                <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} aria-label="Source">
                  <option value="all">All sources</option>
                  {sourceOptions.map((source) => <option value={source} key={source}>{source}</option>)}
                </select>
              </div>
            </div>

            {data && (
              <div className="search-intel">
                <div>
                  <span className="intel-label">Search plan</span>
                  <div className="plan-terms">{data.plan.queries.map((term) => <span key={term}>{term}</span>)}</div>
                </div>
                <div>
                  <span className="intel-label">Live sources</span>
                  <div className="source-status">
                    {data.sources.map((source) => (
                      <span key={source.name} className={source.ok ? "ok" : "bad"} title={source.error || undefined}>
                        <i /> {source.name} {source.ok ? `· ${source.count}` : "· unavailable"}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loading && !data ? (
              <div className="loading-grid">
                {[1, 2, 3, 4].map((i) => <div className="skeleton-card" key={i}><i /><i /><i /><i /></div>)}
              </div>
            ) : (
              <div className="result-grid">
                {visible.map((item) => (
                  <WorkCard
                    item={item}
                    key={item.id}
                    saved={saved.some((savedItem) => savedItem.id === item.id)}
                    onToggleSave={toggleSave}
                    onOpen={setDetail}
                  />
                ))}
              </div>
            )}

            {!loading && data && visible.length === 0 && (
              <div className="empty-state">
                <h3>No opportunities match these filters.</h3>
                <p>Broaden the date/source filters or try a less specific description of what you can do.</p>
              </div>
            )}
          </section>
        )}

        {view === "saved" && (
          <section className="saved-page">
            <div className="saved-head">
              <div>
                <span className="eyebrow">Your shortlist</span>
                <h1>Saved opportunities</h1>
                <p>Stored locally on this device. No account required.</p>
              </div>
              {saved.length > 0 && <button className="secondary-button danger-lite" onClick={() => setSaved([])}>Clear saved</button>}
            </div>

            {saved.length > 0 ? (
              <>
                <div className="result-toolbar saved-toolbar">
                  <div className="filter-tabs">
                    <button className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>All</button>
                    <button className={mode === "leads" ? "active" : ""} onClick={() => setMode("leads")}>Direct leads</button>
                    <button className={mode === "eligible" ? "active" : ""} onClick={() => setMode("eligible")}>Looks eligible</button>
                  </div>
                  <div className="select-filters">
                    <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                      <option value="all">All sources</option>
                      {sourceOptions.map((source) => <option value={source} key={source}>{source}</option>)}
                    </select>
                  </div>
                </div>
                <div className="result-grid">
                  {visible.map((item) => (
                    <WorkCard item={item} key={item.id} saved onToggleSave={toggleSave} onOpen={setDetail} />
                  ))}
                </div>
              </>
            ) : (
              <div className="saved-empty">
                <div className="saved-empty-icon"><BookmarkIcon /></div>
                <h2>Nothing saved yet</h2>
                <p>Save promising leads while you search and they will stay here on this device.</p>
                <button className="primary-button" onClick={() => setView("explore")}>Explore remote work</button>
              </div>
            )}
          </section>
        )}
      </main>

      <footer>
        <div>
          <strong>WorkScout</strong>
          <p>We rank and explain opportunities without hiding where they came from.</p>
        </div>
        <div className="footer-links">
          <span>Job feeds + direct hiring leads</span>
          <button onClick={() => setShowPost(true)}>Post work</button>
        </div>
      </footer>

      {showPost && <PostModal onClose={() => setShowPost(false)} onPosted={handlePosted} />}
      {detail && (
        <DetailModal
          item={detail}
          saved={saved.some((savedItem) => savedItem.id === detail.id)}
          onClose={() => setDetail(null)}
          onToggleSave={toggleSave}
        />
      )}
    </div>
  );
}
