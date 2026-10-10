import { describe, expect, it } from "vitest";

import { AiSdkLLMClient } from "../ai-sdk-llm-client";
import { createByokModel, resolveServerDefaultModel, type ResolvedModel } from "../llm-models";

// Opt-in: SPOOL_LIVE_LLM=1 plus the credentials for each target you want to hit.
const live = process.env.SPOOL_LIVE_LLM === "1";

const targets: Array<{ name: string; enabled: boolean; build: () => ResolvedModel }> = [
  {
    name: "server default",
    enabled: live && Boolean(process.env.SPOOL_DEFAULT_MODEL?.trim() || process.env.LLM_API_KEY),
    build: () => resolveServerDefaultModel(),
  },
  {
    name: "BYOK anthropic",
    enabled: live && Boolean(process.env.SPOOL_LIVE_ANTHROPIC_KEY),
    build: () => createByokModel({ provider: "anthropic", apiKey: process.env.SPOOL_LIVE_ANTHROPIC_KEY }),
  },
  {
    name: "BYOK openai",
    enabled: live && Boolean(process.env.SPOOL_LIVE_OPENAI_KEY),
    build: () => createByokModel({ provider: "openai", apiKey: process.env.SPOOL_LIVE_OPENAI_KEY }),
  },
  {
    name: "BYOK xai",
    enabled: live && Boolean(process.env.SPOOL_LIVE_XAI_KEY),
    build: () => createByokModel({ provider: "xai", apiKey: process.env.SPOOL_LIVE_XAI_KEY }),
  },
];

describe.each(targets)("live LLM: $name", ({ enabled, build }) => {
  it.skipIf(!enabled)("generates text", async () => {
    const text = await new AiSdkLLMClient(build()).generate({
      systemPrompt: [{ text: "Reply with exactly one word.", cacheable: true }],
      messages: [{ role: "user", content: "Say OK." }],
      maxTokens: 20,
    });

    expect(text.trim().length).toBeGreaterThan(0);
  }, 60_000);

  it.skipIf(!enabled)("streams text", async () => {
    let text = "";
    for await (const chunk of new AiSdkLLMClient(build()).generateStreamIterator({
      messages: [{ role: "user", content: "Count from 1 to 5, separated by spaces." }],
      maxTokens: 50,
    })) {
      text += chunk;
    }

    expect(text).toMatch(/1\D+2\D+3/);
  }, 60_000);
});
