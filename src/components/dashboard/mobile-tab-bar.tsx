"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { House } from "@phosphor-icons/react";
import { ChartBar } from "@phosphor-icons/react";
import { Lightbulb } from "@phosphor-icons/react";
import { PencilLine } from "@phosphor-icons/react";
import { Users } from "@phosphor-icons/react";
import { SpeakerHigh } from "@phosphor-icons/react";
import { Compass } from "@phosphor-icons/react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────

interface TabItem {
  label: string;
  icon: typeof House;
  href?: string;
  subItems?: { label: string; href: string; icon: typeof House }[];
}

// ── Tab definitions ──────────────────────────────────────────────────

const tabs: TabItem[] = [
  {
    label: "Today",
    icon: House,
    href: "/dashboard",
  },
  {
    label: "Understand",
    icon: ChartBar,
    subItems: [
      { label: "Performance", href: "/dashboard/understand", icon: ChartBar },
      { label: "Audience", href: "/dashboard/understand/audience", icon: Users },
      { label: "Voice", href: "/dashboard/understand/voice", icon: SpeakerHigh },
    ],
  },
  {
    label: "Insights",
    icon: Lightbulb,
    href: "/dashboard/insights",
  },
  {
    label: "Create",
    icon: PencilLine,
    subItems: [
      { label: "Discover", href: "/dashboard/create", icon: Compass },
      { label: "Scanner", href: "/dashboard/create/scanner", icon: MagnifyingGlass },
      { label: "Compose", href: "/dashboard/create/compose", icon: PencilLine },
    ],
  },
];

// ── Active section detection ─────────────────────────────────────────

function getActiveSection(pathname: string): string {
  if (pathname.startsWith("/dashboard/understand")) return "Understand";
  if (pathname.startsWith("/dashboard/insights")) return "Insights";
  if (pathname.startsWith("/dashboard/create")) return "Create";
  return "Today";
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
  const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

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
              transition={shouldReduceMotion ? instant : { duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
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
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-[var(--radius-lg)] border-2 border-b-0 border-border bg-card pb-[calc(64px+env(safe-area-inset-bottom))] md:hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center py-3">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-3">
                <h3 className="font-heading text-lg font-bold">{sheetTab.label}</h3>
                <button
                  type="button"
                  onClick={() => setSheetSection(null)}
                  className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close navigation"
                >
                  <X weight="bold" className="size-5" />
                </button>
              </div>

              {/* Sub-nav items */}
              <nav className="flex flex-col gap-1 px-4 pb-4">
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
                        "flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <SubIcon
                        weight={isActive ? "fill" : "regular"}
                        className="size-5"
                      />
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
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t-2 border-border bg-card md:hidden"
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
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              <Icon
                weight={isActive ? "fill" : "regular"}
                className="size-6"
              />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
