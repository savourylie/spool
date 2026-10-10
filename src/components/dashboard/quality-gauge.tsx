"use client";

import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";

interface QualityGaugeProps {
  score: number;
  isLoading?: boolean;
}

function getScoreColor(score: number): string {
  if (score < 40) return "var(--destructive)";
  if (score < 70) return "var(--tertiary)";
  return "var(--quaternary)";
}

function getScoreLabel(score: number): string {
  if (score < 40) return "Needs work";
  if (score < 70) return "Fair";
  return "Great";
}

/**
 * SVG semicircular quality gauge (0-100).
 * Color zones: 0-40 red, 40-70 yellow, 70-100 green.
 */
export function QualityGauge({ score, isLoading }: QualityGaugeProps) {
  const clamped = Math.max(0, Math.min(100, score));

  // Arc geometry: semicircle centered at (100, 90), radius 70
  const radius = 70;
  const circumference = Math.PI * radius; // half-circle
  const offset = circumference - (clamped / 100) * circumference;
  const color = getScoreColor(clamped);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox="0 0 200 110"
        className="w-full max-w-[220px]"
        role="img"
        aria-label={`Quality score: ${clamped} out of 100`}
      >
        {/* Background arc */}
        <path
          d="M 30 90 A 70 70 0 0 1 170 90"
          fill="none"
          stroke="var(--muted)"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d="M 30 90 A 70 70 0 0 1 170 90"
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 [transition-timing-function:var(--ease-bounce)]"
        />
        {/* Score number */}
        <text
          x="100"
          y="85"
          textAnchor="middle"
          className="fill-foreground font-heading text-[36px] font-extrabold"
        >
          {clamped}
        </text>
      </svg>

      <div className="flex items-center gap-2">
        <span
          className="text-sm font-bold"
          style={{ color }}
        >
          {getScoreLabel(clamped)}
        </span>
        {isLoading && (
          <SpinnerGap
            weight="bold"
            className="size-4 animate-spin text-muted-foreground"
          />
        )}
      </div>
    </div>
  );
}
