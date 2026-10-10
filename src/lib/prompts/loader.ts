/**
 * Prompt Loader
 *
 * Reads knowledge prompts from `src/lib/prompts/*.md` at module load time
 * and caches them in memory. These markdown files are stable prefixes that
 * ride in the Anthropic prompt cache — they change rarely and are read on
 * every Scanner / Composer call.
 *
 * Server-side only. Consumers should import from `@/lib/prompts/loader`
 * and call `loadPrompt("algorithm")` etc. to get the raw markdown string.
 */

import { readFileSync } from "fs";
import { join } from "path";

const PROMPTS_DIR = join(process.cwd(), "src", "lib", "prompts");

const cache = new Map<string, string>();

/**
 * Load a prompt markdown file by name (without extension).
 *
 * First call reads from disk; subsequent calls return the cached string.
 * Throws with a clear error if the file is missing (e.g. test env misconfig).
 */
export function loadPrompt(name: string): string {
  const cached = cache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const filePath = join(PROMPTS_DIR, `${name}.md`);
  try {
    const content = readFileSync(filePath, "utf-8");
    cache.set(name, content);
    return content;
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    throw new Error(
      `loadPrompt: failed to read '${name}.md' at ${filePath}. ${err}`,
    );
  }
}

/** Clear the in-memory cache. Exposed for tests. */
export function __clearPromptCache(): void {
  cache.clear();
}
