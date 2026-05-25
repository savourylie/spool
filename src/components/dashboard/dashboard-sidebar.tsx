"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  ListBullets,
  ChartBar,
  Clock,
  Users,
  PencilLine,
  MagnifyingGlass,
  Compass,
  SpeakerHigh,
  Lightbulb,
  Books,
  ClockCounterClockwise,
  Gear,
  SignOut,
} from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: typeof House;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "Studio",
    items: [
      { label: "Overview", href: "/dashboard", icon: House },
      { label: "Posts", href: "/dashboard/posts", icon: ListBullets },
      { label: "Performance", href: "/dashboard/understand", icon: ChartBar },
      { label: "Timing", href: "/dashboard/timing", icon: Clock },
      { label: "Audience", href: "/dashboard/understand/audience", icon: Users },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Compose", href: "/dashboard/create/compose", icon: PencilLine },
      { label: "Scanner", href: "/dashboard/create/scanner", icon: MagnifyingGlass },
      { label: "Discover", href: "/dashboard/create", icon: Compass },
    ],
  },
  {
    label: "Library",
    items: [
      { label: "Voice", href: "/dashboard/understand/voice", icon: SpeakerHigh },
      { label: "Topics & Patterns", href: "/dashboard/insights", icon: Lightbulb },
      { label: "Concepts", href: "/dashboard/understand/concepts", icon: Books },
      { label: "Reviews", href: "/dashboard/understand/reviews", icon: ClockCounterClockwise },
    ],
  },
];

// ── Full sidebar nav link (desktop) ──────────────────────────────────

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-foreground font-medium text-background"
          : "text-ink-2 hover:bg-paper-2 hover:text-foreground",
      )}
    >
      <Icon weight="regular" className="size-[18px]" />
      {item.label}
    </Link>
  );
}

// ── Icon-only rail link (tablet) ─────────────────────────────────────

function RailLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      aria-label={item.label}
      title={item.label}
      className={cn(
        "group relative flex items-center justify-center rounded-[var(--radius-sm)] p-2.5 transition-colors",
        isActive
          ? "bg-foreground text-background"
          : "text-ink-3 hover:bg-paper-2 hover:text-foreground",
      )}
    >
      <Icon weight="regular" className="size-[18px]" />
      <span className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-[var(--radius-sm)] border border-border bg-popover px-2.5 py-1 font-mono text-[11px] text-foreground opacity-0 shadow-[var(--shadow-hover)] transition-opacity group-hover:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}

// ── Brand mark ───────────────────────────────────────────────────────

function BrandGlyph({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-block size-5 shrink-0 rounded-[3px] bg-foreground", className)}
    >
      <span className="absolute inset-[4px] border-b border-l border-background" />
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────

export function DashboardSidebar({ username }: { username: string }) {
  const pathname = usePathname();

  const allItems = sections.flatMap((s) => s.items);
  const activeHref =
    [...allItems]
      .sort((a, b) => b.href.length - a.href.length)
      .find(
        (item) =>
          pathname === item.href || pathname.startsWith(item.href + "/"),
      )?.href ?? null;

  const settingsActive =
    pathname === "/dashboard/settings" ||
    pathname.startsWith("/dashboard/settings/");

  return (
    <>
      {/* ── Desktop sidebar (>1024px) ──────────────────────────────── */}
      <aside className="hidden lg:flex h-full w-60 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)]">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-[var(--sidebar-border)] px-5 py-4">
          <BrandGlyph />
          <div className="min-w-0">
            <div className="font-heading text-[17px] font-semibold leading-none tracking-[-0.02em] text-foreground">
              Spool
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-ink-3">
              @{username}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
          {sections.map((section) => (
            <div key={section.label}>
              <div className="px-3 pb-1 pt-4 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
                {section.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    isActive={item.href === activeHref}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-[var(--sidebar-border)] px-3 py-3">
          <Link
            href="/dashboard/settings"
            aria-current={settingsActive ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
              settingsActive
                ? "bg-foreground font-medium text-background"
                : "text-ink-2 hover:bg-paper-2 hover:text-foreground",
            )}
          >
            <Gear weight="regular" className="size-[18px]" />
            Settings
          </Link>
          <form action="/api/auth/sign-out" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-paper-2 hover:text-foreground"
            >
              <SignOut weight="regular" className="size-[18px]" />
              Sign out
            </button>
          </form>
          <div className="mt-1 flex items-center justify-between border-t border-[var(--sidebar-border)] px-3 pt-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-4">
              Theme
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ── Tablet icon rail (768-1024px) ──────────────────────────── */}
      <aside className="hidden md:flex lg:hidden h-full w-14 shrink-0 flex-col items-center border-r border-[var(--sidebar-border)] bg-[var(--sidebar)]">
        {/* Logo */}
        <div className="flex h-[57px] w-full items-center justify-center border-b border-[var(--sidebar-border)]">
          <BrandGlyph />
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto py-3">
          {sections.map((section) => (
            <div
              key={section.label}
              className="flex flex-col items-center gap-0.5 [&:not(:first-child)]:mt-3 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-[var(--sidebar-border)] [&:not(:first-child)]:pt-3"
            >
              {section.items.map((item) => (
                <RailLink
                  key={item.href}
                  item={item}
                  isActive={item.href === activeHref}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 border-t border-[var(--sidebar-border)] py-3">
          <Link
            href="/dashboard/settings"
            title="Settings"
            aria-label="Settings"
            aria-current={settingsActive ? "page" : undefined}
            className={cn(
              "group relative flex items-center justify-center rounded-[var(--radius-sm)] p-2.5 transition-colors",
              settingsActive
                ? "bg-foreground text-background"
                : "text-ink-3 hover:bg-paper-2 hover:text-foreground",
            )}
          >
            <Gear weight="regular" className="size-[18px]" />
            <span className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-[var(--radius-sm)] border border-border bg-popover px-2.5 py-1 font-mono text-[11px] text-foreground opacity-0 shadow-[var(--shadow-hover)] transition-opacity group-hover:opacity-100">
              Settings
            </span>
          </Link>
          <form action="/api/auth/sign-out" method="POST">
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex items-center justify-center rounded-[var(--radius-sm)] p-2.5 text-ink-3 transition-colors hover:bg-paper-2 hover:text-foreground"
            >
              <SignOut weight="regular" className="size-[18px]" />
            </button>
          </form>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
