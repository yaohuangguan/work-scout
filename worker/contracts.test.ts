import { describe, expect, it } from "vitest";
import { PostInputSchema } from "./contracts";

describe("WorkScout post contract", () => {
  it("keeps honeypot submissions silently valid before business validation", () => {
    const result = PostInputSchema["~standard"].validate({
      website: "https://bot.invalid",
      title: "x",
      description: "short",
      contact: "bad",
      skills: "",
    });

    expect(result).not.toBeInstanceOf(Promise);
    if (result instanceof Promise) throw new Error("Unexpected async schema");
    expect("issues" in result).toBe(false);
    if ("value" in result) {
      expect(result.value.website).toBe("https://bot.invalid");
    }
  });

  it("rejects the same invalid post when the honeypot is empty", () => {
    const result = PostInputSchema["~standard"].validate({
      website: "",
      title: "x",
      description: "short",
      contact: "bad",
      skills: "",
    });

    expect(result).not.toBeInstanceOf(Promise);
    if (result instanceof Promise) throw new Error("Unexpected async schema");
    expect("issues" in result).toBe(true);
  });
});
