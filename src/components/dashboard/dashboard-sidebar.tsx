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
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)]">
      {/* Header */}
      <div className="border-b border-[var(--sidebar-border)] px-5 py-6">
        <span className="font-heading text-[22px] font-extrabold text-primary">
          Spool
        </span>
        <p className="mt-1 text-[13px] text-muted-foreground">@{username}</p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {/* Standalone: Today */}
        {standaloneItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            isActive={item.href === activeHref}
          />
        ))}

        {/* Grouped sections */}
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

      {/* Footer: Sign out */}
      <div className="border-t border-[var(--sidebar-border)] px-5 py-4">
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
  );
}
