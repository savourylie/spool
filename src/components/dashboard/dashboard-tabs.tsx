"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar } from "@phosphor-icons/react";
import { Clock } from "@phosphor-icons/react";
import { Users } from "@phosphor-icons/react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { PencilLine } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  href: string;
  icon: typeof ChartBar;
  group: "analyze" | "create";
  badge?: string;
}

const tabs: Tab[] = [
  { label: "Posts", href: "/dashboard/posts", icon: ChartBar, group: "analyze" },
  { label: "Timing", href: "/dashboard/timing", icon: Clock, group: "analyze" },
  { label: "Audience", href: "/dashboard/audience", icon: Users, group: "analyze" },
  { label: "Scanner", href: "/dashboard/scanner", icon: MagnifyingGlass, group: "create" },
  { label: "Compose", href: "/dashboard/compose", icon: PencilLine, group: "create", badge: "Soon" },
];

export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex gap-2 overflow-x-auto border-b-2 border-border md:gap-8">
      {tabs.map((tab, idx) => {
        const isActive = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        // Add a subtle separator between analyze and create groups
        const showDivider =
          idx > 0 && tabs[idx - 1].group !== tab.group;

        return (
          <div key={tab.href} className="flex items-center">
            {showDivider && (
              <div
                aria-hidden
                className="mr-2 h-5 w-px bg-border md:mr-8"
              />
            )}
            <Link
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap pb-3 px-1 font-heading font-bold text-sm -mb-[2px] border-b-2 transition-all duration-300 [transition-timing-function:var(--ease-bounce)] rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring md:gap-2",
                isActive
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              <Icon weight={isActive ? "fill" : "regular"} className="size-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.badge && (
                <span className="hidden rounded-full bg-tertiary/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-tertiary sm:inline-block">
                  {tab.badge}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
