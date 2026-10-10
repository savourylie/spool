import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { ChartBar } from "@phosphor-icons/react/dist/ssr/ChartBar";
import { Clock } from "@phosphor-icons/react/dist/ssr/Clock";
import { Users } from "@phosphor-icons/react/dist/ssr/Users";
import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning";
import { PencilLine } from "@phosphor-icons/react/dist/ssr/PencilLine";

import { buttonVariants } from "@/components/ui/button-variants";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardIcon,
} from "@/components/ui/card";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export default async function Home() {
  const cookieStore = await cookies();
  if (cookieStore.get(SESSION_COOKIE_NAME)) {
    redirect("/dashboard");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* ---- Floating decorations ---- */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 -z-10 hidden size-72 rounded-full bg-secondary/20 md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 -z-10 hidden size-64 rounded-full bg-primary/15 md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-1/3 top-1/2 -z-10 hidden size-4 rounded-full bg-quaternary md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-1/3 left-1/4 -z-10 hidden size-16 rotate-12 rounded-[var(--radius-sm)] border border-dashed border-secondary/40 md:block"
      />

      {/* ---- Hero ---- */}
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 pb-20 pt-24 md:flex-row md:items-center md:gap-16 md:pt-32">
        {/* Left column */}
        <div className="flex flex-1 flex-col items-center text-center md:items-start md:text-left">
          <div className="relative inline-block">
            <div
              aria-hidden
              className="absolute -left-4 -top-4 -z-10 size-20 rounded-full bg-tertiary/60 md:size-24"
            />
            <h1 className="font-heading text-5xl font-extrabold tracking-tight md:text-7xl">
              Spool
            </h1>
          </div>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            See what&apos;s working, understand the algorithm, and know what to
            post next. Spool turns your Threads data into algorithm-aware
            insights and AI-powered content recommendations.
          </p>
          <a
            href="/api/auth/threads"
            className={buttonVariants({ size: "lg", className: "mt-8" })}
          >
            Get Started
            <span className="ml-1 inline-flex size-6 items-center justify-center rounded-full bg-white/30">
              <ArrowRight
                weight="bold"
                className="size-3.5 text-primary-foreground"
              />
            </span>
          </a>
        </div>

        {/* Right column — illustration placeholder */}
        <div className="relative hidden flex-1 md:block">
          <svg
            viewBox="0 0 480 360"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full"
            aria-hidden
          >
            {/* Dot-grid pattern */}
            <defs>
              <pattern
                id="dot-grid"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="1.2" className="fill-line" />
              </pattern>
              <clipPath id="blob">
                <ellipse cx="240" cy="180" rx="210" ry="160" />
              </clipPath>
            </defs>
            <rect
              width="480"
              height="360"
              fill="url(#dot-grid)"
              clipPath="url(#blob)"
            />
            {/* Simplified dashboard shapes */}
            <rect
              x="120"
              y="80"
              width="240"
              height="200"
              rx="6"
              className="fill-card stroke-ink"
              strokeWidth="1"
            />
            {/* Chart bars — monochrome ink ramp + one accent */}
            <rect x="150" y="200" width="24" height="60" rx="2" className="fill-ink-4" />
            <rect x="186" y="170" width="24" height="90" rx="2" className="fill-ink-3" />
            <rect x="222" y="150" width="24" height="110" rx="2" className="fill-accent" />
            <rect x="258" y="180" width="24" height="80" rx="2" className="fill-ink-3" />
            <rect x="294" y="160" width="24" height="100" rx="2" className="fill-ink-4" />
            {/* Title bar lines */}
            <rect x="150" y="105" width="80" height="8" rx="2" className="fill-line" />
            <rect x="150" y="122" width="120" height="6" rx="2" className="fill-paper-3" />
          </svg>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="relative mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-4 text-center font-heading text-3xl font-medium md:text-4xl">
          Analytics that understand the algorithm
        </h2>
        <p className="mx-auto mb-12 max-w-lg text-center text-muted-foreground">
          Track what works, learn why it works, and create more of it.
        </p>

        {/* Top row — 3 analytics features */}
        <div className="grid gap-8 md:grid-cols-3">
          <StickerCard className="pt-8">
            <StickerCardIcon color="primary">
              <ChartBar weight="fill" className="size-6" />
            </StickerCardIcon>
            <StickerCardHeader>
              <StickerCardTitle>Weighted Performance</StickerCardTitle>
              <StickerCardDescription>
                See how the algorithm scores your posts — shares and comments
                matter far more than likes.
              </StickerCardDescription>
            </StickerCardHeader>
          </StickerCard>

          <StickerCard className="pt-8">
            <StickerCardIcon color="secondary">
              <Clock weight="fill" className="size-6" />
            </StickerCardIcon>
            <StickerCardHeader>
              <StickerCardTitle>Timing &amp; Cadence</StickerCardTitle>
              <StickerCardDescription>
                Find your best posting times and optimal spacing to avoid the
                algorithm&apos;s diversity filter.
              </StickerCardDescription>
            </StickerCardHeader>
          </StickerCard>

          <StickerCard className="pt-8">
            <StickerCardIcon color="tertiary">
              <Users weight="fill" className="size-6" />
            </StickerCardIcon>
            <StickerCardHeader>
              <StickerCardTitle>Audience Fit</StickerCardTitle>
              <StickerCardDescription>
                Track follower growth, demographics, and whether your audience
                actually matches your content niche.
              </StickerCardDescription>
            </StickerCardHeader>
          </StickerCard>
        </div>

        {/* Bottom row — 2 intelligence features, wider cards */}
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <StickerCard className="pt-8">
            <StickerCardIcon color="quaternary">
              <Lightning weight="fill" className="size-6" />
            </StickerCardIcon>
            <StickerCardHeader>
              <StickerCardTitle>Content Scanner</StickerCardTitle>
              <StickerCardDescription>
                Analyze your posts for patterns the algorithm demotes —
                clickbait, engagement bait, and semantic duplicates.
              </StickerCardDescription>
            </StickerCardHeader>
          </StickerCard>

          <StickerCard className="pt-8">
            <StickerCardIcon color="primary">
              <PencilLine weight="fill" className="size-6" />
            </StickerCardIcon>
            <StickerCardHeader>
              <StickerCardTitle>AI Composer</StickerCardTitle>
              <StickerCardDescription>
                Draft algorithm-optimized posts based on what&apos;s already
                working for your audience. Powered by your own data.
              </StickerCardDescription>
            </StickerCardHeader>
          </StickerCard>
        </div>
      </section>
    </div>
  );
}
