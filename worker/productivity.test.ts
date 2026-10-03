import { describe, expect, it } from "vitest";
import { watchCandidates, watchPrefs, type WatchRow } from "./productivity";
import type { WorkItem } from "./search";

const row: WatchRow = {
  id: "watch-1",
  client_hash: "client",
  label: "React watch",
  query: "React Node",
  country_code: "NZ",
  country_label: "New Zealand",
  hours_per_week: 20,
  work_types: "contract,part-time,gig",
  created_at: "2026-10-04T00:00:00.000Z",
  updated_at: "2026-10-04T00:00:00.000Z",
  last_checked_at: null,
  last_match_at: null,
  enabled: 1,
  last_error: "",
};

function item(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: "item",
    title: "React contract",
    company: "Example",
    summary: "React work",
    source: "Example",
    sourceUrl: "https://example.com",
    applyUrl: "https://example.com/apply",
    postedAt: "2026-10-04T00:00:00.000Z",
    type: "Contract",
    location: "Worldwide",
    salary: null,
    tags: ["react"],
    eligibility: "eligible",
    eligibilityText: "Worldwide",
    score: 80,
    why: ["Matches react"],
    kind: "Contract",
    ...overrides,
  };
}

describe("Scout Watch", () => {
  it("reconstructs search preferences from a persisted watch", () => {
    expect(watchPrefs(row)).toEqual({
      raw: "React Node",
      countryCode: "NZ",
      countryLabel: "New Zealand",
      hoursPerWeek: 20,
      workTypes: ["contract", "part-time", "gig"],
    });
  });

  it("keeps strong eligible/uncertain matches and removes weak or restricted ones", () => {
    const result = watchCandidates([
      item({ id: "good" }),
      item({ id: "uncertain", eligibility: "uncertain", score: 55 }),
      item({ id: "weak", score: 39 }),
      item({ id: "restricted", eligibility: "restricted", score: 95 }),
    ]);

    expect(result.map((entry) => entry.id)).toEqual(["good", "uncertain"]);
  });
});
