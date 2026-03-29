"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House } from "@phosphor-icons/react";
import { ChartBar } from "@phosphor-icons/react";
import { Users } from "@phosphor-icons/react";
import { Lightbulb } from "@phosphor-icons/react";
import { Compass } from "@phosphor-icons/react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { PencilLine } from "@phosphor-icons/react";
import { SignOut } from "@phosphor-icons/react";
import { Gear } from "@phosphor-icons/react";
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

const standaloneItems: NavItem[] = [
  { label: "Today", href: "/dashboard", icon: House },
];

const sections: NavSection[] = [
  {
    label: "UNDERSTAND",
    items: [
      { label: "Performance", href: "/dashboard/understand", icon: ChartBar },
      {
        label: "Audience",
        href: "/dashboard/understand/audience",
        icon: Users,
      },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      {
        label: "Topics & Patterns",
        href: "/dashboard/insights",
        icon: Lightbulb,
      },
    ],
  },
  {
    label: "CREATE",
    items: [
      { label: "Discover", href: "/dashboard/create", icon: Compass },
      {
        label: "Scanner",
        href: "/dashboard/create/scanner",
        icon: MagnifyingGlass,
      },
      {
        label: "Compose",
        href: "/dashboard/create/compose",
        icon: PencilLine,
      },
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
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-accent-foreground)]"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/50"
      )}
    >
      <Icon
        weight={isActive ? "fill" : "regular"}
        className={cn("size-5", isActive ? "text-primary" : "")}
      />
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
        "group relative flex items-center justify-center rounded-lg p-2.5 transition-colors",
        isActive
          ? "bg-[var(--sidebar-accent)] text-primary"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)]/50",
      )}
    >
      <Icon weight={isActive ? "fill" : "regular"} className="size-5" />
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-[var(--radius-sm)] border-2 border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-[var(--shadow-default)] transition-opacity group-hover:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}

// ── Component ────────────────────────────────────────────────────────

export function DashboardSidebar({ username }: { username: string }) {
  const pathname = usePathname();

  const allItems = [...standaloneItems, ...sections.flatMap((s) => s.items)];
  const activeHref =
    [...allItems]
      .sort((a, b) => b.href.length - a.href.length)
      .find(
        (item) =>
          pathname === item.href || pathname.startsWith(item.href + "/")
      )?.href ?? null;

  return (
    <>
      {/* ── Desktop sidebar (>1024px) ──────────────────────────────── */}
      <aside className="hidden lg:flex h-full w-60 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)]">
        {/* Header */}
        <div className="border-b border-[var(--sidebar-border)] px-5 py-6">
          <span className="font-heading text-[22px] font-extrabold text-primary">
            Spool
          </span>
          <p className="mt-1 text-[13px] text-muted-foreground">@{username}</p>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {standaloneItems.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              isActive={item.href === activeHref}
            />
          ))}

          {sections.map((section) => (
            <div key={section.label} className="mt-2">
              <span className="px-3 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground">
                {section.label}
              </span>
              <div className="mt-1 flex flex-col gap-1">
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
        <div className="border-t border-[var(--sidebar-border)] px-5 py-4 space-y-2">
          <Link
            href="/dashboard/settings"
            className={cn(
              "flex items-center gap-2 text-[13px] font-medium transition-colors",
              pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/")
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Gear
              weight={pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/") ? "fill" : "regular"}
              className="size-[18px]"
            />
            Settings
          </Link>
          <form action="/api/auth/sign-out" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <SignOut className="size-[18px]" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Tablet icon rail (768-1024px) ──────────────────────────── */}
      <aside className="hidden md:flex lg:hidden h-full w-14 shrink-0 flex-col items-center border-r border-[var(--sidebar-border)] bg-[var(--sidebar)]">
        {/* Logo */}
        <div className="flex h-[73px] items-center justify-center border-b border-[var(--sidebar-border)]">
          <span className="font-heading text-lg font-extrabold text-primary">S</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
          {standaloneItems.map((item) => (
            <RailLink
              key={item.href}
              item={item}
              isActive={item.href === activeHref}
            />
          ))}

          {sections.map((section) => (
            <div key={section.label} className="mt-2 flex flex-col items-center gap-1">
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
        <div className="border-t border-[var(--sidebar-border)] py-4 flex flex-col items-center gap-1">
          <Link
            href="/dashboard/settings"
            title="Settings"
            aria-label="Settings"
            className={cn(
              "group relative flex items-center justify-center rounded-lg p-2.5 transition-colors",
              pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/")
                ? "bg-[var(--sidebar-accent)] text-primary"
                : "text-muted-foreground hover:bg-[var(--sidebar-accent)]/50",
            )}
          >
            <Gear
              weight={pathname === "/dashboard/settings" || pathname.startsWith("/dashboard/settings/") ? "fill" : "regular"}
              className="size-5"
            />
            <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-[var(--radius-sm)] border-2 border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow-[var(--shadow-default)] transition-opacity group-hover:opacity-100">
              Settings
            </span>
          </Link>
          <form action="/api/auth/sign-out" method="POST">
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-[var(--sidebar-accent)]/50 hover:text-foreground"
            >
              <SignOut className="size-[18px]" />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
