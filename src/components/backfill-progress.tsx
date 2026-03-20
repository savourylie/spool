"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap"
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { createClient } from "@/lib/supabase/client"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Button } from "@/components/ui/button"

function getMessage(percentage: number | null) {
  if (percentage === null) return "Warming up the thread spool..."
  if (percentage <= 0) return "Warming up the thread spool..."
  if (percentage <= 20) return "Unraveling your threads..."
  if (percentage <= 50) return "Analyzing your best posts..."
  if (percentage <= 80) return "Crunching the numbers..."
  if (percentage < 100) return "Almost there..."
  return "All done! Redirecting..."
}

const springBounce = {
  type: "spring" as const,
  stiffness: 300,
  damping: 20,
}

export function BackfillProgress({
  jobId: initialJobId,
  initialStatus,
  initialProcessed,
  initialTotal,
}: {
  jobId: string
  initialStatus: string
  initialProcessed: number | null
  initialTotal: number | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [processed, setProcessed] = useState(initialProcessed ?? 0)
  const [total, setTotal] = useState(initialTotal)
  const [jobId, setJobId] = useState(initialJobId)
  const [retrying, setRetrying] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)
  const supabaseRef = useRef(createClient())

  const percentage =
    status === "complete"
      ? 100
      : total && total > 0
        ? Math.round((processed / total) * 100)
        : null

  const subscribe = useCallback(
    (id: string) => {
      const supabase = supabaseRef.current

      // Clean up previous channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }

      const channel = supabase
        .channel(`backfill-${id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "backfill_jobs",
            filter: `id=eq.${id}`,
          },
          (payload) => {
            const row = payload.new as {
              status: string
              processed_posts: number | null
              total_posts: number | null
            }
            setStatus(row.status)
            setProcessed(row.processed_posts ?? 0)
            setTotal(row.total_posts)
          },
        )
        .subscribe()

      channelRef.current = channel
    },
    [],
  )

  // Subscribe to realtime updates for the current job
  useEffect(() => {
    const supabase = supabaseRef.current
    subscribe(jobId)

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [jobId, subscribe])

  // Redirect on complete
  useEffect(() => {
    if (status === "complete") {
      const timer = setTimeout(() => router.push("/dashboard"), 800)
      return () => clearTimeout(timer)
    }
  }, [status, router])

  async function handleRetry() {
    setRetrying(true)
    try {
      const res = await fetch("/api/backfill/retry", { method: "POST" })
      if (!res.ok) throw new Error("Retry failed")
      const { jobId: newJobId } = await res.json()
      setJobId(newJobId)
      setStatus("pending")
      setProcessed(0)
      setTotal(null)
      subscribe(newJobId)
    } catch {
      // Stay on error state
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      {/* Decorative shapes — hidden on mobile */}
      <div className="pointer-events-none hidden md:block" aria-hidden>
        <svg className="absolute top-[10%] left-[8%] size-20 text-secondary opacity-30" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="40" fill="currentColor" />
        </svg>
        <svg className="absolute top-[20%] right-[10%] size-16 text-tertiary opacity-25" viewBox="0 0 80 80">
          <polygon points="40,0 80,80 0,80" fill="currentColor" />
        </svg>
        <svg className="absolute bottom-[15%] left-[12%] size-14 text-quaternary opacity-30" viewBox="0 0 80 80">
          <polygon points="40,0 80,80 0,80" fill="currentColor" />
        </svg>
        <svg className="absolute right-[6%] bottom-[25%] size-24 text-secondary opacity-20" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="40" fill="currentColor" />
        </svg>
        <svg className="absolute top-[55%] left-[5%] size-10 text-tertiary opacity-35" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="40" fill="currentColor" />
        </svg>
      </div>

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={springBounce}
        className="z-10 flex w-full max-w-md flex-col items-center gap-6"
      >
        {/* Icon */}
        <div className="flex size-16 items-center justify-center rounded-full border-2 border-foreground bg-primary shadow-[var(--shadow-default)]">
          {status === "failed" ? (
            <WarningCircle weight="bold" className="size-8 text-primary-foreground" />
          ) : status === "complete" ? (
            <CheckCircle weight="bold" className="size-8 text-primary-foreground" />
          ) : (
            <SpinnerGap weight="bold" className="size-8 animate-spin text-primary-foreground" />
          )}
        </div>

        {/* Heading */}
        <h1 className="font-heading text-center text-2xl font-bold">
          {status === "failed"
            ? "Something went wrong"
            : status === "complete"
              ? "All done!"
              : "Analyzing your posts"}
        </h1>

        {/* Progress bar — hide on failed */}
        {status !== "failed" && (
          <ProgressBar percentage={percentage} className="w-full" />
        )}

        {/* Percentage text */}
        {status !== "failed" && percentage !== null && (
          <p className="text-sm font-bold text-muted-foreground">{percentage}%</p>
        )}

        {/* Animated message */}
        <div className="h-6">
          <AnimatePresence mode="wait">
            <motion.p
              key={status === "failed" ? "error" : getMessage(percentage)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="text-center text-sm text-muted-foreground"
            >
              {status === "failed"
                ? "We couldn\u2019t finish importing your posts."
                : getMessage(percentage)}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Retry button */}
        {status === "failed" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...springBounce }}
          >
            <Button onClick={handleRetry} disabled={retrying}>
              {retrying ? "Retrying..." : "Try Again"}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
