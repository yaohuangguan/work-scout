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
