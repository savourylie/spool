"use client";

import type { LaunchScore } from "@/lib/velocity-check";

interface VelocityIndicatorProps {
  score: LaunchScore;
  velocity: number;
  average: number;
}

const SCORE_CONFIG: Record<
  LaunchScore,
  { bg: string; text: string; label: string }
> = {
  green: {
    bg: "bg-quaternary/20",
    text: "text-quaternary",
    label: "Strong Launch",
  },
  yellow: {
    bg: "bg-tertiary/20",
    text: "text-tertiary",
    label: "Average Launch",
  },
  red: {
    bg: "bg-destructive/20",
    text: "text-destructive",
    label: "Slow Launch",
  },
};

export function VelocityIndicator({
  score,
  velocity,
  average,
}: VelocityIndicatorProps) {
  const config = SCORE_CONFIG[score];

  return (
    <span
      role="status"
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold leading-none ${config.bg} ${config.text}`}
      title={`First 3-hour engagement velocity: ${velocity.toFixed(2)}x vs ${average.toFixed(2)}x average`}
      aria-label={`${config.label}: ${velocity.toFixed(2)}x velocity vs ${average.toFixed(2)}x average`}
    >
      {config.label}
    </span>
  );
}
