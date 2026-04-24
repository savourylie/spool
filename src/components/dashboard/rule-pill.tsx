import { getAlgorithmRule } from "@/lib/algorithm-rules";

interface RulePillProps {
  rule: string;
}

/**
 * Small pill rendering a rule tag (e.g. "R3", "S12") with a native
 * `title` tooltip sourced from `algorithm.md`. Falls back to the raw
 * tag when the lookup misses so we never block a finding from rendering.
 */
export function RulePill({ rule }: RulePillProps) {
  const entry = getAlgorithmRule(rule);
  const summary = entry
    ? `${entry.title} — ${entry.summary}`
    : `Unknown rule: ${rule}`;

  return (
    <span
      title={summary}
      aria-label={summary}
      className="inline-flex items-center rounded-full border-2 border-foreground/60 bg-muted px-2 py-0.5 font-mono text-[0.7rem] font-bold leading-none text-foreground"
    >
      {rule}
    </span>
  );
}
