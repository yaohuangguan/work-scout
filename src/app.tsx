import { FormEvent, useEffect, useMemo, useState } from "react";

type Eligibility = "eligible" | "uncertain" | "restricted";

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

const typeOptions = [
  ["contract", "Contract"],
  ["part-time", "Part-time"],
  ["gig", "Gig"],
  ["full-time", "Full-time"],
] as const;

const examples = [
  "React + Node, 20h/week",
  "Video editing for short-form content",
  "Customer support, Chinese + English",
  "Excel / data entry evenings",
  "AI automation + website maintenance",
];

function relativeDate(value: string | null) {
  if (!value) return "Date not listed";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 31) return `${days} days ago`;
  return new Date(value).toLocaleDateString();
}

function eligibilityLabel(value: Eligibility) {
  if (value === "eligible") return "Looks eligible";
  if (value === "restricted") return "Likely restricted";
  return "Check location";
}

function WorkCard({ item }: { item: WorkItem }) {
  return (
    <article className="work-card">
      <div className="card-topline">
        <div className="source-row">
          <span className="kind-pill">{item.kind}</span>
          <span className="source-name">{item.source}</span>
          <span className="dot">•</span>
          <span>{relativeDate(item.postedAt)}</span>
        </div>
        <div className="match-score">{item.score}% match</div>
      </div>

      <div className="card-heading">
        <div>
          <h3>{item.title}</h3>
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
        <a className="primary-link" href={item.applyUrl} target="_blank" rel="noreferrer">
          {item.source === "WorkScout" ? "Contact poster" : "Open original"}
          <span aria-hidden>↗</span>
        </a>
        <span className="eligibility-note">{item.eligibilityText}</span>
      </div>
    </article>
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
  });
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    setError("");
    const response = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
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
            <p>No account in the MVP. Add a direct contact method and it becomes searchable immediately.</p>
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
              <input required minLength={3} maxLength={120} placeholder="e.g. Fix a React checkout flow" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
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
                <input placeholder="React, Shopify, video editing..." value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
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
  const [query, setQuery] = useState("React, Node, AI automation, website maintenance");
  const [country, setCountry] = useState("NZ");
  const [hours, setHours] = useState(20);
  const [types, setTypes] = useState<string[]>(["contract", "part-time", "gig"]);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState("");
  const [filter, setFilter] = useState<"all" | "eligible" | "flexible">("all");
  const [showPost, setShowPost] = useState(false);

  async function runSearch(nextQuery = query) {
    setLoading(true);
    const params = new URLSearchParams({
      q: nextQuery,
      country,
      countryLabel: country === "NZ" ? "New Zealand" : country,
      hours: String(hours),
      types: types.join(","),
    });
    try {
      const response = await fetch(`/api/search?${params}`);
      if (!response.ok) throw new Error("Search failed");
      const body = await response.json();
      setData(body);
      setSearched(nextQuery);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runSearch();
    // Initial discovery search only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const items = data?.items ?? [];
    if (filter === "eligible") return items.filter((item) => item.eligibility === "eligible");
    if (filter === "flexible") return items.filter((item) => /contract|part.?time|freelance|temporary|gig/i.test(item.type) || item.kind === "Lead");
    return items;
  }, [data, filter]);

  function toggleType(value: string) {
    setTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function chooseExample(value: string) {
    setQuery(value);
    void runSearch(value);
  }

  function handlePosted(nextQuery: string) {
    if (nextQuery) setQuery(nextQuery);
    window.setTimeout(() => void runSearch(nextQuery || query), 250);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-mark">W</span>
          <span>WorkScout</span>
          <span className="beta">MVP</span>
        </a>
        <div className="header-actions">
          <span className="header-note">Search work, not job titles.</span>
          <button className="secondary-button" onClick={() => setShowPost(true)}>Post work</button>
        </div>
      </header>

      <main>
        <section className="hero">
          <span className="eyebrow">Remote work discovery engine</span>
          <h1>Find remote work you can <em>actually take.</em></h1>
          <p className="hero-copy">Tell us what you can do, where you are, and how much you want to work. WorkScout searches multiple sources, checks location fit, and brings the original opportunity back to you.</p>

          <div className="search-panel">
            <label className="search-label">What can you do?</label>
            <div className="search-row">
              <textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={2} placeholder="React, customer support, Excel, video editing, AI automation…" />
              <button className="search-button" onClick={() => void runSearch()} disabled={loading}>
                {loading ? "Searching…" : "Find work"}
              </button>
            </div>

            <div className="preference-row">
              <label>
                Based in
                <select value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="NZ">New Zealand</option>
                  <option value="AU">Australia</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                </select>
              </label>
              <label>
                Up to
                <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                  <option value={10}>10 h/week</option>
                  <option value={20}>20 h/week</option>
                  <option value={25}>25 h/week</option>
                  <option value={40}>40 h/week</option>
                </select>
              </label>
              <div className="type-group">
                <span>Open to</span>
                <div className="type-options">
                  {typeOptions.map(([value, label]) => (
                    <button key={value} className={types.includes(value) ? "selected" : ""} onClick={() => toggleType(value)}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="examples">
            <span>Try:</span>
            {examples.map((example) => <button key={example} onClick={() => chooseExample(example)}>{example}</button>)}
          </div>
        </section>

        <section className="results-section">
          <div className="results-head">
            <div>
              <span className="eyebrow">Live discovery</span>
              <h2>{loading ? "Searching the web…" : `${visible.length} opportunities`}</h2>
              <p>{searched ? <>For <strong>{searched}</strong></> : "Describe what you can do to start."}</p>
            </div>
            <div className="filter-tabs">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Best matches</button>
              <button className={filter === "eligible" ? "active" : ""} onClick={() => setFilter("eligible")}>Looks eligible</button>
              <button className={filter === "flexible" ? "active" : ""} onClick={() => setFilter("flexible")}>Flexible work</button>
            </div>
          </div>

          {data && (
            <div className="search-intel">
              <div>
                <span className="intel-label">Search plan</span>
                <div className="plan-terms">{data.plan.queries.map((term) => <span key={term}>{term}</span>)}</div>
              </div>
              <div>
                <span className="intel-label">Sources</span>
                <div className="source-status">
                  {data.sources.map((source) => (
                    <span key={source.name} className={source.ok ? "ok" : "bad"}>
                      <i /> {source.name} {source.ok ? `· ${source.count}` : "· unavailable"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="result-grid">
            {visible.map((item) => <WorkCard item={item} key={item.id} />)}
          </div>

          {!loading && data && visible.length === 0 && (
            <div className="empty-state">
              <h3>No strong matches yet.</h3>
              <p>Try a broader skill such as “customer support”, “design”, “video editor”, or “React”.</p>
            </div>
          )}
        </section>
      </main>

      <footer>
        <div>
          <strong>WorkScout MVP</strong>
          <p>Original listings stay with their source. We rank and explain; we do not hide the source.</p>
        </div>
        <div className="footer-links">
          <a href="https://himalayas.app" target="_blank" rel="noreferrer">Himalayas</a>
          <a href="https://remoteok.com" target="_blank" rel="noreferrer">Remote OK</a>
          <a href="https://remotive.com" target="_blank" rel="noreferrer">Remotive</a>
        </div>
      </footer>

      {showPost && <PostModal onClose={() => setShowPost(false)} onPosted={handlePosted} />}
    </div>
  );
}
