"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  House,
  ChartBar,
  PencilLine,
  Books,
  ListBullets,
  Clock,
  Users,
  MagnifyingGlass,
  Compass,
  SpeakerHigh,
  Lightbulb,
  ClockCounterClockwise,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────

interface SubItem {
  label: string;
  href: string;
  icon: typeof House;
}

interface TabItem {
  label: string;
  icon: typeof House;
  href?: string;
  subItems?: SubItem[];
}

// ── Tab definitions ──────────────────────────────────────────────────

const tabs: TabItem[] = [
  { label: "Overview", icon: House, href: "/dashboard" },
  {
    label: "Studio",
    icon: ChartBar,
    subItems: [
      { label: "Posts", href: "/dashboard/posts", icon: ListBullets },
      { label: "Performance", href: "/dashboard/understand", icon: ChartBar },
      { label: "Timing", href: "/dashboard/timing", icon: Clock },
      { label: "Audience", href: "/dashboard/understand/audience", icon: Users },
    ],
  },
  {
    label: "Tools",
    icon: PencilLine,
    subItems: [
      { label: "Compose", href: "/dashboard/create/compose", icon: PencilLine },
      { label: "Scanner", href: "/dashboard/create/scanner", icon: MagnifyingGlass },
      { label: "Discover", href: "/dashboard/create", icon: Compass },
    ],
  },
  {
    label: "Library",
    icon: Books,
    subItems: [
      { label: "Voice", href: "/dashboard/understand/voice", icon: SpeakerHigh },
      { label: "Topics & Patterns", href: "/dashboard/insights", icon: Lightbulb },
      { label: "Concepts", href: "/dashboard/understand/concepts", icon: Books },
      { label: "Reviews", href: "/dashboard/understand/reviews", icon: ClockCounterClockwise },
    ],
  },
];

// ── Active section detection (longest-prefix across all hrefs) ───────

const HREF_TO_TAB: { href: string; tab: string }[] = tabs
  .flatMap((t) =>
    t.href
      ? [{ href: t.href, tab: t.label }]
      : (t.subItems ?? []).map((s) => ({ href: s.href, tab: t.label })),
  )
  .sort((a, b) => b.href.length - a.href.length);

function getActiveSection(pathname: string): string {
  const match = HREF_TO_TAB.find(
    (e) => pathname === e.href || pathname.startsWith(e.href + "/"),
  );
  return match?.tab ?? "Overview";
}

// ── Component ────────────────────────────────────────────────────────

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [sheetSection, setSheetSection] = useState<string | null>(null);

  const activeSection = getActiveSection(pathname);

  const handleTabPress = useCallback(
    (tab: TabItem) => {
      if (tab.subItems) {
        setSheetSection((prev) => (prev === tab.label ? null : tab.label));
      } else if (tab.href) {
        setSheetSection(null);
        router.push(tab.href);
      }
    },
    [router],
  );

  const handleSheetNavigate = useCallback(
    (href: string) => {
      setSheetSection(null);
      router.push(href);
    },
    [router],
  );

  const sheetTab = tabs.find((t) => t.label === sheetSection);

  const instant = { duration: 0 };
  const spring = { type: "spring" as const, stiffness: 400, damping: 32 };

  return (
    <>
      {/* Slide-up sheet overlay */}
      <AnimatePresence>
        {sheetTab?.subItems && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              transition={shouldReduceMotion ? instant : { duration: 0.18 }}
              className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
              onClick={() => setSheetSection(null)}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={shouldReduceMotion ? false : { y: "100%" }}
              animate={{ y: 0 }}
              exit={shouldReduceMotion ? undefined : { y: "100%" }}
              transition={shouldReduceMotion ? instant : spring}
              drag={shouldReduceMotion ? false : "y"}
              dragConstraints={{ top: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80) setSheetSection(null);
              }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-[var(--radius-lg)] border border-b-0 border-border bg-card pb-[calc(64px+env(safe-area-inset-bottom))] md:hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center py-3">
                <div className="h-1 w-10 rounded-full bg-line-strong" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3">
                <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                  {sheetTab.label}
                </h3>
                <button
                  type="button"
                  onClick={() => setSheetSection(null)}
                  className="rounded-[var(--radius-sm)] p-1.5 text-ink-3 transition-colors hover:bg-paper-2 hover:text-foreground"
                  aria-label="Close navigation"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Sub-nav items */}
              <nav className="flex flex-col gap-0.5 px-3 pb-4">
                {sheetTab.subItems.map((sub) => {
                  const SubIcon = sub.icon;
                  const isActive =
                    pathname === sub.href ||
                    pathname.startsWith(sub.href + "/");
                  return (
                    <button
                      key={sub.href}
                      type="button"
                      onClick={() => handleSheetNavigate(sub.href)}
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--radius-sm)] px-4 py-3 text-sm transition-colors",
                        isActive
                          ? "bg-foreground font-medium text-background"
                          : "text-ink-2 hover:bg-paper-2 hover:text-foreground",
                      )}
                    >
                      <SubIcon weight="regular" className="size-5" />
                      {sub.label}
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-card md:hidden"
        style={{ height: "calc(64px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
        role="tablist"
        aria-label="Main navigation"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.label;
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabPress(tab)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors",
                isActive ? "text-foreground" : "text-ink-4",
              )}
            >
              <Icon weight="regular" className="size-6" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
