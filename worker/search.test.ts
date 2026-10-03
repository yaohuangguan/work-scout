import { describe, expect, it } from "vitest";
import { planQuery, scoreWork, type SearchPreferences, type WorkItem } from "./search";

const prefs: SearchPreferences = {
  raw: "React contract",
  countryCode: "NZ",
  countryLabel: "New Zealand",
  hoursPerWeek: 20,
  workTypes: ["contract", "part-time", "gig"],
};

function item(overrides: Partial<Omit<WorkItem, "score" | "why">> = {}): Omit<WorkItem, "score" | "why"> {
  return {
    id: "x",
    title: "React developer",
    company: "Example",
    summary: "Maintain a React application",
    source: "Test",
    sourceUrl: "https://example.com",
    applyUrl: "https://example.com/apply",
    postedAt: new Date().toISOString(),
    type: "Contract",
    location: "Worldwide",
    salary: null,
    tags: ["React"],
    eligibility: "eligible",
    eligibilityText: "Worldwide",
    kind: "Contract",
    ...overrides,
  };
}

describe("planQuery", () => {
  it("expands Chinese and English skill descriptions", () => {
    const plan = planQuery("我会剪辑，也能做 customer support 和 AI 自动化");
    expect(plan.terms).toContain("video editor");
    expect(plan.terms).toContain("customer support");
    expect(plan.terms).toContain("automation");
  });
});

describe("scoreWork", () => {
  it("ranks eligible flexible work above location-restricted work", () => {
    const eligible = scoreWork(item(), prefs, ["react"]);
    const restricted = scoreWork(
      item({ eligibility: "restricted", eligibilityText: "US only", location: "US only" }),
      prefs,
      ["react"]
    );
    expect(eligible.score).toBeGreaterThan(restricted.score);
  });

  it("boosts flexible work when weekly availability is limited", () => {
    const contract = scoreWork(item({ type: "Contract" }), prefs, ["react"]);
    const fullTime = scoreWork(item({ type: "Full-time", kind: "Job" }), prefs, ["react"]);
    expect(contract.score).toBeGreaterThan(fullTime.score);
  });
});
