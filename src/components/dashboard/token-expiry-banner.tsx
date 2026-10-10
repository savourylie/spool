import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { buttonVariants } from "@/components/ui/button-variants";

export type TokenStatus = "valid" | "expiring" | "expired";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function getTokenStatus(expiresAt: string): TokenStatus {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  if (expiry <= now) return "expired";
  if (expiry - now <= SEVEN_DAYS_MS) return "expiring";
  return "valid";
}

const config = {
  expired: {
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    iconColor: "text-destructive",
    message:
      "Your Threads connection has expired. Reconnect to continue getting updates.",
    cta: "Reconnect",
  },
  expiring: {
    bg: "bg-tertiary/10",
    border: "border-tertiary/30",
    iconColor: "text-tertiary",
    message:
      "Your Threads connection expires soon. Reconnect to keep your data flowing.",
    cta: "Reconnect",
  },
} as const;

export function TokenExpiryBanner({
  status,
}: {
  status: "expiring" | "expired";
}) {
  const c = config[status];

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border ${c.border} ${c.bg} px-4 py-3`}
    >
      <WarningCircle weight="bold" className={`size-5 shrink-0 ${c.iconColor}`} />
      <p className="flex-1 text-sm font-medium">{c.message}</p>
      <Link
        href="/api/auth/threads"
        className={buttonVariants({ variant: "candy", size: "sm" })}
      >
        {c.cta}
      </Link>
    </div>
  );
}
