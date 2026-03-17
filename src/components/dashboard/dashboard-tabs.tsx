"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar } from "@phosphor-icons/react";
import { Clock } from "@phosphor-icons/react";
import { Users } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Posts", href: "/dashboard/posts", icon: ChartBar },
  { label: "Timing", href: "/dashboard/timing", icon: Clock },
  { label: "Audience", href: "/dashboard/audience", icon: Users },
] as const;

export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex gap-8 border-b-2 border-border">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 pb-3 px-1 font-heading font-bold text-sm -mb-[2px] border-b-2 transition-all duration-300 [transition-timing-function:var(--ease-bounce)]",
              isActive
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <Icon weight={isActive ? "fill" : "regular"} className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
