"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PencilLine } from "@phosphor-icons/react/dist/ssr/PencilLine";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";

import { Button } from "@/components/ui/button";

// ── Component ────────────────────────────────────────────────────────

export function QuickCompose() {
  const router = useRouter();
  const [topic, setTopic] = useState("");

  function handleGenerate() {
    const trimmed = topic.trim();
    if (!trimmed) return;
    router.push(
      `/dashboard/create/compose?topic=${encodeURIComponent(trimmed)}`,
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border-2 border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-accent text-white">
          <PencilLine weight="bold" className="size-4" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Quick Compose
        </p>
      </div>

      {/* Topic input */}
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleGenerate();
        }}
        placeholder="Enter a topic to generate drafts..."
        className="w-full rounded-[var(--radius-md)] border-2 border-[#CBD5E1] bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:shadow-[4px_4px_0_var(--accent)] focus:outline-none"
      />

      {/* Generate button */}
      <Button
        variant="candy"
        size="sm"
        className="mt-3 w-full"
        onClick={handleGenerate}
        disabled={!topic.trim()}
      >
        <PencilLine weight="bold" className="size-4" />
        Generate
      </Button>

      {/* Link to full composer */}
      <div className="mt-4 flex justify-end">
        <Link
          href="/dashboard/create/compose"
          className="inline-flex items-center gap-1 text-xs font-bold text-accent transition-all duration-300 [transition-timing-function:var(--ease-bounce)] hover:gap-2"
        >
          Open full composer
          <ArrowRight weight="bold" className="size-3" />
        </Link>
      </div>
    </div>
  );
}
