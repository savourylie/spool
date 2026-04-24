/**
 * Scanner stream parser — extract completed axis objects from a partially
 * received JSON accumulator during SSE streaming.
 *
 * TICKET-077's v2 stream delivers the LLM's raw JSON text chunk-by-chunk,
 * then emits a `__v2_result` sentinel with the fully-resolved diagnostic.
 * Between chunks the UI flips each axis card from skeleton to populated as
 * soon as its JSON object closes — this utility does that without waiting
 * for the final sentinel.
 *
 * Limitations:
 *  - Does not resolve `neighborPosts` (server populates those on the
 *    sentinel from `_citations`). Partial results render the Style axis
 *    without its "Similar posts" strip.
 *  - Assumes the top-level shape is a JSON object with the four axis keys
 *    as direct children. Malformed or unexpectedly-nested inputs return
 *    nothing for that axis.
 *  - Tolerant: returns partial results and never throws.
 */

import type { ScannerDiagnosticV2 } from "@/lib/quality-scanner-shared";

const AXIS_KEYS = [
  "styleMatch",
  "psychology",
  "algorithm",
  "aiDetection",
] as const;
type AxisKey = (typeof AXIS_KEYS)[number];

export function extractCompletedAxes(
  accumulator: string,
): Partial<ScannerDiagnosticV2> {
  const result: Partial<Record<AxisKey, ScannerDiagnosticV2[AxisKey]>> = {};
  for (const key of AXIS_KEYS) {
    const parsed = findAxisValue(accumulator, key);
    if (parsed) {
      result[key] = parsed;
    }
  }
  return result as Partial<ScannerDiagnosticV2>;
}

function findAxisValue(
  source: string,
  key: AxisKey,
): ScannerDiagnosticV2[AxisKey] | null {
  const pattern = `"${key}"`;
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const keyPos = source.indexOf(pattern, searchFrom);
    if (keyPos === -1) return null;

    if (!isKeyPosition(source, keyPos)) {
      searchFrom = keyPos + pattern.length;
      continue;
    }

    const valueStart = findValueStart(source, keyPos + pattern.length);
    if (valueStart === -1 || source[valueStart] !== "{") {
      searchFrom = keyPos + pattern.length;
      continue;
    }

    const valueEnd = findMatchingBrace(source, valueStart);
    if (valueEnd === -1) return null;

    try {
      const parsed = JSON.parse(source.slice(valueStart, valueEnd + 1));
      if (isAxisShape(parsed)) {
        return parsed as ScannerDiagnosticV2[AxisKey];
      }
    } catch {
      // fall through to next occurrence
    }

    searchFrom = valueEnd + 1;
  }

  return null;
}

function isKeyPosition(source: string, keyPos: number): boolean {
  let i = keyPos - 1;
  while (i >= 0 && isWhitespace(source[i])) i--;
  if (i < 0) return false;
  return source[i] === "{" || source[i] === ",";
}

function findValueStart(source: string, afterKey: number): number {
  let i = afterKey;
  while (i < source.length && isWhitespace(source[i])) i++;
  if (i >= source.length || source[i] !== ":") return -1;
  i++;
  while (i < source.length && isWhitespace(source[i])) i++;
  return i >= source.length ? -1 : i;
}

function findMatchingBrace(source: string, start: number): number {
  if (source[start] !== "{") return -1;
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"') {
      const end = skipString(source, i);
      if (end === -1) return -1;
      i = end + 1;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function skipString(source: string, openPos: number): number {
  let j = openPos + 1;
  while (j < source.length) {
    const ch = source[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (ch === '"') return j;
    j++;
  }
  return -1;
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isAxisShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.summary === "string" && Array.isArray(record.findings)
  );
}
