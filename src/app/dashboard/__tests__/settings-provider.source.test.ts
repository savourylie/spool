import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("settings provider choices source", () => {
  it("offers xAI as a bring-your-own-key provider", async () => {
    const form = await readFile(
      new URL("../../../components/dashboard/settings-form.tsx", import.meta.url),
      "utf8",
    );

    expect(form).toContain('value: "xai"');
    expect(form).toContain('label: "xAI (Grok)"');
    expect(form).toContain("PROVIDER_DEFAULTS");
  });

  it("passes the saved provider through the shared LLMProvider type", async () => {
    const page = await readFile(new URL("../settings/page.tsx", import.meta.url), "utf8");

    expect(page).toContain("LLMProvider");
  });
});
