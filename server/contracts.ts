import type { StandardSchemaV1 } from "openmesh-node";
import type { SearchPreferences, WorkItem, QueryPlan } from "../worker/search";

export type SourceStatus = {
  name: string;
  ok: boolean;
  count: number;
  error?: string | null;
};

export type ExternalSearchResponse = {
  plan: QueryPlan;
  items: WorkItem[];
  sources: SourceStatus[];
};

export type CommunitySearchResponse = {
  items: WorkItem[];
  source: SourceStatus;
};

export type SearchResponse = {
  query: SearchPreferences;
  plan: QueryPlan;
  count: number;
  items: WorkItem[];
  sources: SourceStatus[];
};

export type PostInput = {
  title: string;
  company?: string;
  description: string;
  skills: string[] | string;
  workType?: string;
  locationScope?: string;
  contact: string;
  budget?: string;
  website?: string;
};

export type PostCreated = {
  ok: true;
  id: string;
  createdAt: string;
};

export type ApiError = {
  error: string;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message?: string };

function standard<T>(
  name: string,
  validate: (value: unknown) => ValidationResult<T>,
): StandardSchemaV1<unknown, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "workscout",
      validate(value) {
        const result = validate(value);
        return result.ok
          ? { value: result.value }
          : { issues: [{ message: result.message || `Invalid ${name}` }] };
      },
    },
  };
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const stringValue = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

export const SearchQuerySchema = standard<SearchPreferences>("search query", (value) => {
  const input = asRecord(value);
  if (!input) return { ok: false };

  const raw = stringValue(input.q).trim() || "remote";
  const countryCode = stringValue(input.country, "ANY").toUpperCase();
  const countryLabel = stringValue(
    input.countryLabel,
    countryCode === "ANY" ? "Anywhere / not sure" : countryCode,
  );
  const parsedHours = Number(stringValue(input.hours, "20"));
  const workTypes = stringValue(input.types, "contract,part-time,gig")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    ok: true,
    value: {
      raw,
      countryCode,
      countryLabel,
      hoursPerWeek: Number.isFinite(parsedHours)
        ? Math.max(1, Math.min(80, parsedHours))
        : 20,
      workTypes,
    },
  };
});

export const SearchPreferencesSchema = standard<SearchPreferences>(
  "search preferences",
  (value) => {
    const input = asRecord(value);
    if (!input) return { ok: false };

    if (
      typeof input.raw !== "string" ||
      typeof input.countryCode !== "string" ||
      typeof input.countryLabel !== "string" ||
      typeof input.hoursPerWeek !== "number" ||
      !Array.isArray(input.workTypes) ||
      input.workTypes.some((item) => typeof item !== "string")
    ) return { ok: false };

    return {
      ok: true,
      value: {
        raw: input.raw,
        countryCode: input.countryCode,
        countryLabel: input.countryLabel,
        hoursPerWeek: input.hoursPerWeek,
        workTypes: input.workTypes as string[],
      },
    };
  },
);

export const PostInputSchema = standard<PostInput>("post", (value) => {
  const input = asRecord(value);
  if (!input) return { ok: false };

  const title = stringValue(input.title).trim();
  const description = stringValue(input.description).trim();
  const contact = stringValue(input.contact).trim();
  const company = stringValue(input.company).trim();
  const workType = stringValue(input.workType, "Contract").trim();
  const locationScope = stringValue(input.locationScope, "Worldwide").trim();
  const budget = stringValue(input.budget).trim();
  const website = stringValue(input.website).trim();

  const skills = Array.isArray(input.skills)
    ? input.skills.filter((item): item is string => typeof item === "string")
    : stringValue(input.skills);

  // Preserve the existing honeypot behavior: bots receive a normal success response
  // without learning which validation rule exposed them.
  if (!website) {
    if (title.length < 3 || title.length > 120) {
      return { ok: false, message: "Title must be 3–120 characters." };
    }
    if (description.length < 20 || description.length > 3000) {
      return { ok: false, message: "Description must be 20–3000 characters." };
    }
    if (contact.length < 5 || contact.length > 300) {
      return { ok: false, message: "Add an email or application URL." };
    }
    if (!contact.includes("@") && !/^https?:\/\//i.test(contact)) {
      return { ok: false, message: "Contact must be an email or http(s) URL." };
    }
  }

  return {
    ok: true,
    value: {
      title,
      company,
      description,
      skills,
      workType,
      locationScope,
      contact,
      budget,
      website,
    },
  };
});

export const CommunityPostRequestSchema = standard<{
  post: PostInput;
  fingerprint: string;
}>("community post request", (value) => {
  const input = asRecord(value);
  if (!input || typeof input.fingerprint !== "string" || !input.fingerprint) {
    return { ok: false };
  }
  const validated = PostInputSchema["~standard"].validate(input.post);
  if (validated instanceof Promise || "issues" in validated) return { ok: false };
  return {
    ok: true,
    value: {
      post: validated.value,
      fingerprint: input.fingerprint,
    },
  };
});

export function jsonObjectSchema<T>(name: string): StandardSchemaV1<unknown, T> {
  return standard<T>(name, (value) =>
    asRecord(value)
      ? { ok: true, value: value as T }
      : { ok: false },
  );
}

export function jsonArraySchema<T>(name: string): StandardSchemaV1<unknown, T[]> {
  return standard<T[]>(name, (value) =>
    Array.isArray(value)
      ? { ok: true, value: value as T[] }
      : { ok: false },
  );
}
