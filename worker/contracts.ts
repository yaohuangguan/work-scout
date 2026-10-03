import type { StandardSchemaV1 } from "openmesh-node";
import type { SearchPreferences } from "./search";

type Result<T> = { ok: true; value: T } | { ok: false };

function schema<T>(
  name: string,
  validate: (value: unknown) => Result<T>,
): StandardSchemaV1<unknown, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "workscout",
      validate(value) {
        const result = validate(value);
        return result.ok
          ? { value: result.value }
          : { issues: [{ message: `Invalid ${name}` }] };
      },
    },
  };
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

export const SearchQuerySchema = schema<SearchPreferences>("search query", (value) => {
  const input = record(value);
  if (!input) return { ok: false };

  const raw = text(input.q).trim() || "remote";
  const countryCode = text(input.country, "ANY").toUpperCase();
  const countryLabel = text(
    input.countryLabel,
    countryCode === "ANY" ? "Anywhere / not sure" : countryCode,
  );
  const hours = Number(text(input.hours, "20"));
  const types = text(input.types, "contract,part-time,gig")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    ok: true,
    value: {
      raw,
      countryCode,
      countryLabel,
      hoursPerWeek: Number.isFinite(hours) ? Math.max(1, Math.min(80, hours)) : 20,
      workTypes: types,
    },
  };
});

export type PostInput = {
  title: string;
  company: string;
  description: string;
  skills: string[] | string;
  workType: string;
  locationScope: string;
  contact: string;
  budget: string;
  website: string;
};

export const PostInputSchema = schema<PostInput>("post", (value) => {
  const input = record(value);
  if (!input) return { ok: false };

  const title = text(input.title).trim();
  const company = text(input.company).trim();
  const description = text(input.description).trim();
  const contact = text(input.contact).trim();
  const workType = text(input.workType, "Contract").trim();
  const locationScope = text(input.locationScope, "Worldwide").trim();
  const budget = text(input.budget).trim();
  const website = text(input.website).trim();
  const skills = Array.isArray(input.skills)
    ? input.skills.filter((item): item is string => typeof item === "string")
    : text(input.skills);

  if (website) {
    return {
      ok: true,
      value: {
        title,
        company,
        description,
        contact,
        workType,
        locationScope,
        budget,
        website,
        skills,
      },
    };
  }

  if (title.length < 3 || title.length > 120) return { ok: false };
  if (description.length < 20 || description.length > 3000) return { ok: false };
  if (contact.length < 5 || contact.length > 300) return { ok: false };
  if (!contact.includes("@") && !/^https?:\/\//i.test(contact)) return { ok: false };

  return {
    ok: true,
    value: {
      title,
      company,
      description,
      contact,
      workType,
      locationScope,
      budget,
      website,
      skills,
    },
  };
});

export function objectSchema<T>(name: string): StandardSchemaV1<unknown, T> {
  return schema<T>(name, (value) =>
    record(value)
      ? { ok: true, value: value as T }
      : { ok: false },
  );
}


export type WatchInput = {
  label: string;
  query: string;
  country: string;
  countryLabel: string;
  hours: number;
  types: string[];
};

export const WatchInputSchema = schema<WatchInput>("watch", (value) => {
  const input = record(value);
  if (!input) return { ok: false };

  const label = text(input.label).trim().slice(0, 80);
  const query = text(input.query).trim();
  const country = text(input.country, "ANY").trim().toUpperCase();
  const countryLabel = text(
    input.countryLabel,
    country === "ANY" ? "Anywhere / not sure" : country,
  ).trim();
  const hours = Number(input.hours ?? 20);
  const rawTypes = Array.isArray(input.types)
    ? input.types.filter((item): item is string => typeof item === "string")
    : text(input.types, "contract,part-time,gig").split(",");
  const types = rawTypes
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);

  if (query.length < 2 || query.length > 500) return { ok: false };
  if (!Number.isFinite(hours) || hours < 1 || hours > 80) return { ok: false };
  if (!types.length) return { ok: false };

  return {
    ok: true,
    value: {
      label,
      query,
      country,
      countryLabel,
      hours: Math.round(hours),
      types,
    },
  };
});

export const PipelineStatusSchema = schema<{
  item: Record<string, unknown>;
  status: "saved" | "contacted" | "applied" | "interview" | "offer" | "closed";
  notes: string;
}>("pipeline item", (value) => {
  const input = record(value);
  if (!input) return { ok: false };

  const item = record(input.item);
  const status = text(input.status).trim();
  const notes = text(input.notes).trim().slice(0, 1000);
  const allowed = new Set([
    "saved",
    "contacted",
    "applied",
    "interview",
    "offer",
    "closed",
  ]);

  if (!item || typeof item.id !== "string" || !item.id.trim()) {
    return { ok: false };
  }
  if (!allowed.has(status)) return { ok: false };

  return {
    ok: true,
    value: {
      item,
      status: status as "saved" | "contacted" | "applied" | "interview" | "offer" | "closed",
      notes,
    },
  };
});
