import { FormEvent, useEffect, useMemo, useState } from "react";

type Eligibility = "eligible" | "uncertain" | "restricted";
type View = "explore" | "saved" | "watches" | "pipeline";
type Mode = "all" | "leads" | "eligible" | "flexible";
type PipelineStatus = "saved" | "contacted" | "applied" | "interview" | "offer" | "closed";
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

type WatchSummary = {
  id: string;
  label: string;
  query: string;
  country: string;
  countryLabel: string;
  hours: number;
  types: string[];
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
  lastMatchAt: string | null;
  enabled: boolean;
  lastError: string;
  matchCount: number;
  newCount: number;
};

type WatchMatch = {
  item: WorkItem;
  firstSeenAt: string;
  isNew: boolean;
};

type PipelineEntry = {
  item: WorkItem;
  status: PipelineStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
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

const pipelineColumns: Array<{ value: PipelineStatus; label: string }> = [
  { value: "saved", label: "Saved" },
  { value: "contacted", label: "Contacted" },
  { value: "applied", label: "Applied" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "closed", label: "Closed" },
];

const STORAGE = {
  saved: "workscout:saved:v1",
  recent: "workscout:recent:v1",
  client: "workscout:client:v1",
};

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const apiUrl = (path: string) => `${API_BASE}${path}`;

function clientKey() {
  const existing = localStorage.getItem(STORAGE.client);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(STORAGE.client, created);
  return created;
}

function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-workscout-client", clientKey());
  return fetch(apiUrl(path), { ...init, headers });
}

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
  pipelineStatus,
  onClose,
  onToggleSave,
  onPipelineStatus,
}: {
  item: WorkItem;
  saved: boolean;
  pipelineStatus?: PipelineStatus;
  onClose: () => void;
  onToggleSave: (item: WorkItem) => void;
  onPipelineStatus: (item: WorkItem, status: PipelineStatus) => void;
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
          <label className="pipeline-select-wrap">
            <span>Pipeline</span>
            <select
              value={pipelineStatus || ""}
              onChange={(event) => {
                const value = event.target.value as PipelineStatus;
                if (value) onPipelineStatus(item, value);
              }}
            >
              <option value="">Not tracked</option>
              {pipelineColumns.map((column) => (
                <option value={column.value} key={column.value}>{column.label}</option>
              ))}
            </select>
          </label>
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

function WatchPage({
  watches,
  selectedWatchId,
  matches,
  busyId,
  onOpen,
  onRun,
  onDelete,
  onBack,
  saved,
  onToggleSave,
  onOpenItem,
}: {
  watches: WatchSummary[];
  selectedWatchId: string | null;
  matches: WatchMatch[];
  busyId: string | null;
  onOpen: (id: string) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  saved: WorkItem[];
  onToggleSave: (item: WorkItem) => void;
  onOpenItem: (item: WorkItem) => void;
}) {
  const selected = watches.find((watch) => watch.id === selectedWatchId);

  if (selected) {
    return (
      <section className="saved-page watch-page">
        <div className="saved-head">
          <div>
            <button className="back-link" onClick={onBack}>← All watches</button>
            <span className="eyebrow">Scout Watch</span>
            <h1>{selected.label || selected.query}</h1>
            <p>{selected.countryLabel} · ≤{selected.hours}h/week · {selected.types.join(", ")}</p>
          </div>
          <button className="secondary-button" onClick={() => onRun(selected.id)} disabled={busyId === selected.id}>
            {busyId === selected.id ? "Checking…" : "Check now"}
          </button>
        </div>

        <div className="watch-summary-bar">
          <div><strong>{matches.length}</strong><span>tracked matches</span></div>
          <div><strong>{matches.filter((match) => match.isNew).length}</strong><span>new</span></div>
          <div><strong>{selected.lastCheckedAt ? relativeDate(selected.lastCheckedAt) : "Never"}</strong><span>last checked</span></div>
        </div>

        {matches.length ? (
          <div className="result-grid">
            {matches.map(({ item, isNew }) => (
              <div className={isNew ? "watch-match-new" : ""} key={item.id}>
                {isNew && <span className="new-match-badge">New match</span>}
                <WorkCard
                  item={item}
                  saved={saved.some((savedItem) => savedItem.id === item.id)}
                  onToggleSave={onToggleSave}
                  onOpen={onOpenItem}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="saved-empty compact-empty">
            <h2>No tracked matches yet</h2>
            <p>Run the watch now or let the scheduled scout check again later.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="saved-page watch-page">
      <div className="saved-head">
        <div>
          <span className="eyebrow">Always-on discovery</span>
          <h1>Scout Watches</h1>
          <p>WorkScout re-runs due searches about every 6 hours and keeps only newly discovered opportunities.</p>
        </div>
      </div>

      {watches.length ? (
        <div className="watch-grid">
          {watches.map((watch) => (
            <article className="watch-card" key={watch.id}>
              <div className="watch-card-top">
                <div>
                  <span className="watch-live-dot" />
                  <span>{watch.enabled ? "Watching" : "Paused"}</span>
                </div>
                {watch.newCount > 0 && <strong className="new-count">{watch.newCount} new</strong>}
              </div>
              <h2>{watch.label || watch.query}</h2>
              <p>{watch.query}</p>
              <div className="watch-meta">
                <span>{watch.countryLabel}</span>
                <span>≤{watch.hours}h/week</span>
                <span>{watch.matchCount} tracked</span>
              </div>
              <div className="watch-card-footer">
                <span>{watch.lastCheckedAt ? `Checked ${relativeDate(watch.lastCheckedAt)}` : "Not checked yet"}</span>
                <div>
                  <button className="detail-button" onClick={() => onDelete(watch.id)}>Delete</button>
                  <button className="secondary-button" onClick={() => onRun(watch.id)} disabled={busyId === watch.id}>
                    {busyId === watch.id ? "Checking…" : "Check"}
                  </button>
                  <button className="primary-button" onClick={() => onOpen(watch.id)}>Open</button>
                </div>
              </div>
              {watch.lastError && <div className="watch-error">{watch.lastError}</div>}
            </article>
          ))}
        </div>
      ) : (
        <div className="saved-empty">
          <h2>No watches yet</h2>
          <p>Run a search, then choose <strong>Watch this search</strong>. WorkScout will keep checking it in the background.</p>
        </div>
      )}
    </section>
  );
}

function PipelinePage({
  entries,
  onOpen,
  onMove,
}: {
  entries: PipelineEntry[];
  onOpen: (item: WorkItem) => void;
  onMove: (item: WorkItem, status: PipelineStatus) => void;
}) {
  return (
    <section className="pipeline-page">
      <div className="saved-head">
        <div>
          <span className="eyebrow">From discovery to outcome</span>
          <h1>Apply Pipeline</h1>
          <p>Keep track of what you saved, contacted, applied to, and what moved forward.</p>
        </div>
      </div>

      <div className="pipeline-board">
        {pipelineColumns.map((column) => {
          const items = entries.filter((entry) => entry.status === column.value);
          return (
            <section className="pipeline-column" key={column.value}>
              <header>
                <span>{column.label}</span>
                <strong>{items.length}</strong>
              </header>
              <div className="pipeline-list">
                {items.map((entry) => (
                  <article className="pipeline-card" key={entry.item.id}>
                    <button onClick={() => onOpen(entry.item)}>
                      <span className="pipeline-source">{entry.item.source}</span>
                      <strong>{entry.item.title}</strong>
                      <span>{entry.item.company}</span>
                    </button>
                    <select
                      value={entry.status}
                      onChange={(event) => onMove(entry.item, event.target.value as PipelineStatus)}
                      aria-label={`Move ${entry.item.title}`}
                    >
                      {pipelineColumns.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </article>
                ))}
                {!items.length && <div className="pipeline-empty">Nothing here yet.</div>}
              </div>
            </section>
          );
        })}
      </div>
    </section>
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
  const [watches, setWatches] = useState<WatchSummary[]>([]);
  const [watchMatches, setWatchMatches] = useState<WatchMatch[]>([]);
  const [selectedWatchId, setSelectedWatchId] = useState<string | null>(null);
  const [watchBusyId, setWatchBusyId] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([]);
  const [productMessage, setProductMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryParam = params.get("q")?.trim();
    const countryParam = params.get("country")?.toUpperCase();
    const hoursParam = Number(params.get("hours"));
    const typesParam = params.get("types")
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (queryParam) setQuery(queryParam);
    if (countryParam && countryNames[countryParam]) setCountry(countryParam);
    if ([10, 20, 25, 40].includes(hoursParam)) setHours(hoursParam);
    if (typesParam?.length) setTypes(typesParam);
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/meta"))
      .then((response) => response.ok
        ? response.json() as Promise<{ country?: string }>
        : null)
      .then((meta) => {
        const hasCountryParam = new URLSearchParams(window.location.search).has("country");
        if (!hasCountryParam && meta?.country && countryNames[meta.country]) setCountry(meta.country);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE.saved, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    localStorage.setItem(STORAGE.recent, JSON.stringify(recent));
  }, [recent]);

  async function loadWatches() {
    const response = await apiFetch("/api/watches");
    if (!response.ok) return;
    const body = await response.json() as { items: WatchSummary[] };
    setWatches(body.items || []);
  }

  async function loadPipeline() {
    const response = await apiFetch("/api/pipeline");
    if (!response.ok) return;
    const body = await response.json() as { items: PipelineEntry[] };
    setPipeline(body.items || []);
  }

  useEffect(() => {
    void Promise.all([
      loadWatches().catch(() => undefined),
      loadPipeline().catch(() => undefined),
    ]);
  }, []);

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
    const alreadySaved = saved.some((savedItem) => savedItem.id === item.id);
    setSaved((current) => alreadySaved
      ? current.filter((savedItem) => savedItem.id !== item.id)
      : [item, ...current]);

    if (!alreadySaved && !pipeline.some((entry) => entry.item.id === item.id)) {
      void updatePipeline(item, "saved");
    }
  }

  async function createCurrentWatch() {
    if (!searched) return;
    setProductMessage("");
    const response = await apiFetch("/api/watches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: searched,
        query: searched,
        country,
        countryLabel: countryNames[country] || country,
        hours,
        types,
      }),
    });
    if (!response.ok) {
      setProductMessage("Could not create this watch.");
      return;
    }
    const result = await response.json() as { existing?: boolean };
    await loadWatches();
    setProductMessage(
      result.existing
        ? "You are already watching this search."
        : "Scout Watch created. WorkScout will check it about every 6 hours.",
    );
  }

  async function openWatch(id: string) {
    setWatchBusyId(id);
    try {
      const response = await apiFetch(`/api/watches/${encodeURIComponent(id)}/matches`);
      if (!response.ok) return;
      const body = await response.json() as { items: WatchMatch[] };
      setWatchMatches(body.items || []);
      setSelectedWatchId(id);
      setView("watches");
      await apiFetch(`/api/watches/${encodeURIComponent(id)}/read`, { method: "POST" });
      await loadWatches();
    } finally {
      setWatchBusyId(null);
    }
  }

  async function runWatch(id: string) {
    setWatchBusyId(id);
    setProductMessage("");
    try {
      const response = await apiFetch(`/api/watches/${encodeURIComponent(id)}/run`, {
        method: "POST",
      });
      if (!response.ok) {
        setProductMessage("This watch could not be refreshed.");
        return;
      }
      await loadWatches();
      if (selectedWatchId === id) await openWatch(id);
    } finally {
      setWatchBusyId(null);
    }
  }

  async function removeWatch(id: string) {
    await apiFetch(`/api/watches/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (selectedWatchId === id) {
      setSelectedWatchId(null);
      setWatchMatches([]);
    }
    await loadWatches();
  }

  async function updatePipeline(item: WorkItem, status: PipelineStatus) {
    const existing = pipeline.find((entry) => entry.item.id === item.id);
    const response = await apiFetch("/api/pipeline", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        item,
        status,
        notes: existing?.notes || "",
      }),
    });
    if (!response.ok) {
      setProductMessage("Could not update the application pipeline.");
      return;
    }
    await loadPipeline();
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
        <a
          className="brand brand-button"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            setView("explore");
          }}
        >
          <span className="brand-mark">W</span>
          <span>WorkScout</span>
          <span className="beta">BETA</span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === "explore" ? "active" : ""} onClick={() => setView("explore")}>Explore</button>
          <button className={view === "watches" ? "active" : ""} onClick={() => {
            setSelectedWatchId(null);
            setView("watches");
            void loadWatches();
          }}>
            Watches <span>{watches.reduce((sum, watch) => sum + watch.newCount, 0)}</span>
          </button>
          <button className={view === "pipeline" ? "active" : ""} onClick={() => {
            setView("pipeline");
            void loadPipeline();
          }}>
            Pipeline <span>{pipeline.length}</span>
          </button>
          <button className={view === "saved" ? "active" : ""} onClick={() => setView("saved")}>
            Saved <span>{saved.length}</span>
          </button>
        </nav>

        <div className="header-actions">
          <button className="secondary-button" onClick={() => setShowPost(true)}>Post work</button>
        </div>
      </header>

      <main>
        {productMessage && (
          <div className="product-message" role="status">
            <span>{productMessage}</span>
            <button onClick={() => setProductMessage("")} aria-label="Dismiss">×</button>
          </div>
        )}

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

            {!hasSearched && (
              <section className="seo-home" id="how-it-works" aria-labelledby="how-workscout-works">
                <div className="seo-home-intro">
                  <span className="eyebrow">How WorkScout works</span>
                  <h2 id="how-workscout-works">One search across remote jobs and direct hiring leads.</h2>
                  <p>
                    WorkScout looks beyond a single job board. It combines remote job feeds with public hiring leads,
                    then ranks opportunities by skills, location fit, work type, weekly availability and freshness.
                    Every result keeps the original source visible.
                  </p>
                </div>
                <div className="seo-home-grid">
                  <article>
                    <strong>1</strong>
                    <h3>Describe what you can do</h3>
                    <p>Search by capability and constraints, not only by a job title.</p>
                  </article>
                  <article>
                    <strong>2</strong>
                    <h3>Check fit before the click</h3>
                    <p>See location restrictions, flexibility, source and freshness earlier.</p>
                  </article>
                  <article>
                    <strong>3</strong>
                    <h3>Keep the search moving</h3>
                    <p>Use Scout Watch for new matches and Pipeline to track follow-up.</p>
                  </article>
                </div>
                <nav className="seo-link-grid" aria-label="Remote work resources">
                  <a href="/remote-work/"><strong>Remote work</strong><span>Search jobs and leads with fit signals →</span></a>
                  <a href="/freelance-work/"><strong>Freelance work</strong><span>Contract, gig and project opportunities →</span></a>
                  <a href="/remote-jobs-new-zealand/"><strong>Remote jobs in New Zealand</strong><span>Screen country restrictions earlier →</span></a>
                  <a href="/direct-hiring-leads/"><strong>Direct hiring leads</strong><span>Find public hiring intent beyond job boards →</span></a>
                  <a href="/guides/how-to-find-remote-work/"><strong>Remote work guide</strong><span>A practical search workflow for 2026 →</span></a>
                  <a href="/guides/remote-job-scams/"><strong>Remote job scam checklist</strong><span>Verify sources and suspicious offers →</span></a>
                </nav>
              </section>
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
                <div className="result-head-actions">
                  <button className="watch-search-button" onClick={() => void createCurrentWatch()}>
                    + Watch this search
                  </button>
                  <div className="result-stats">
                    <div><strong>{stats.leads}</strong><span>direct leads</span></div>
                    <div><strong>{stats.eligible}</strong><span>look eligible</span></div>
                    <div><strong>{stats.fresh}</strong><span>≤7 days old</span></div>
                  </div>
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

        {view === "watches" && (
          <WatchPage
            watches={watches}
            selectedWatchId={selectedWatchId}
            matches={watchMatches}
            busyId={watchBusyId}
            onOpen={(id) => void openWatch(id)}
            onRun={(id) => void runWatch(id)}
            onDelete={(id) => void removeWatch(id)}
            onBack={() => {
              setSelectedWatchId(null);
              setWatchMatches([]);
            }}
            saved={saved}
            onToggleSave={toggleSave}
            onOpenItem={setDetail}
          />
        )}

        {view === "pipeline" && (
          <PipelinePage
            entries={pipeline}
            onOpen={setDetail}
            onMove={(item, status) => void updatePipeline(item, status)}
          />
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
          <a href="/remote-work/">Remote work</a>
          <a href="/freelance-work/">Freelance</a>
          <a href="/direct-hiring-leads/">Direct leads</a>
          <a href="/guides/how-to-find-remote-work/">Guides</a>
          <button onClick={() => setShowPost(true)}>Post work</button>
        </div>
      </footer>

      {showPost && <PostModal onClose={() => setShowPost(false)} onPosted={handlePosted} />}
      {detail && (
        <DetailModal
          item={detail}
          saved={saved.some((savedItem) => savedItem.id === detail.id)}
          pipelineStatus={pipeline.find((entry) => entry.item.id === detail.id)?.status}
          onClose={() => setDetail(null)}
          onToggleSave={toggleSave}
          onPipelineStatus={(item, status) => void updatePipeline(item, status)}
        />
      )}
    </div>
  );
}
