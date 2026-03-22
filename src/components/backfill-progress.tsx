"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap"
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Button } from "@/components/ui/button"
import { useBackfillJob } from "@/hooks/use-backfill-job"
import {
  getBackfillLastUpdatedAt,
  getBackfillPercentage,
  getBackfillStageLabel,
  getBackfillStaleMessage,
  isImportingBackfillStatus,
  type BackfillJob,
} from "@/lib/backfill-job"

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
})

function formatRelativeTime(dateString: string | null, now: number) {
  if (!dateString) return null

  const timestamp = new Date(dateString).getTime()
  if (Number.isNaN(timestamp)) return null

  const diffSeconds = Math.round((timestamp - now) / 1000)
  const absSeconds = Math.abs(diffSeconds)

  if (absSeconds < 60) {
    return relativeTimeFormatter.format(diffSeconds, "second")
  }

  const diffMinutes = Math.round(diffSeconds / 60)
  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute")
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour")
  }

  const diffDays = Math.round(diffHours / 24)
  return relativeTimeFormatter.format(diffDays, "day")
}

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
  initialJob,
}: {
  initialJob: BackfillJob
}) {
  const router = useRouter()
  const shouldReduceMotion = useReducedMotion()
  const { job, retrying, retry } = useBackfillJob(initialJob)
  const [now, setNow] = useState(() => Date.now())
  const currentJob = job ?? initialJob
  const status = currentJob.status
  const percentage = getBackfillPercentage(currentJob)
  const stageLabel = getBackfillStageLabel(currentJob)
  const lastUpdatedLabel = formatRelativeTime(
    getBackfillLastUpdatedAt(currentJob),
    now,
  )
  const staleMessage = getBackfillStaleMessage(currentJob, now)

  useEffect(() => {
    if (!isImportingBackfillStatus(status)) return

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 5000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [status])

  useEffect(() => {
    if (status === "complete") {
      const timer = setTimeout(() => router.push("/dashboard"), 800)
      return () => clearTimeout(timer)
    }
  }, [status, router])

  async function handleRetry() {
    try {
      await retry()
    } catch {
      // Stay on error state.
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none hidden md:block" aria-hidden>
        <svg
          className="absolute top-[10%] left-[8%] size-20 text-secondary opacity-30"
          viewBox="0 0 80 80"
        >
          <circle cx="40" cy="40" r="40" fill="currentColor" />
        </svg>
        <svg
          className="absolute top-[20%] right-[10%] size-16 text-tertiary opacity-25"
          viewBox="0 0 80 80"
        >
          <polygon points="40,0 80,80 0,80" fill="currentColor" />
        </svg>
        <svg
          className="absolute bottom-[15%] left-[12%] size-14 text-quaternary opacity-30"
          viewBox="0 0 80 80"
        >
          <polygon points="40,0 80,80 0,80" fill="currentColor" />
        </svg>
        <svg
          className="absolute right-[6%] bottom-[25%] size-24 text-secondary opacity-20"
          viewBox="0 0 80 80"
        >
          <circle cx="40" cy="40" r="40" fill="currentColor" />
        </svg>
        <svg
          className="absolute top-[55%] left-[5%] size-10 text-tertiary opacity-35"
          viewBox="0 0 80 80"
        >
          <circle cx="40" cy="40" r="40" fill="currentColor" />
        </svg>
      </div>

      <motion.div
        initial={shouldReduceMotion ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={shouldReduceMotion ? { duration: 0.01 } : springBounce}
        className="z-10 flex w-full max-w-md flex-col items-center gap-6"
      >
        <div className="flex size-16 items-center justify-center rounded-full border-2 border-foreground bg-primary shadow-[var(--shadow-default)]">
          {status === "failed" ? (
            <WarningCircle weight="bold" className="size-8 text-primary-foreground" />
          ) : status === "complete" ? (
            <CheckCircle weight="bold" className="size-8 text-primary-foreground" />
          ) : (
            <SpinnerGap weight="bold" className="size-8 animate-spin text-primary-foreground" />
          )}
        </div>

        <h1 className="font-heading text-center text-2xl font-bold">
          {status === "failed"
            ? "Something went wrong"
            : status === "complete"
              ? "All done!"
              : "Analyzing your posts"}
        </h1>

        {status !== "failed" && (
          <ProgressBar percentage={percentage} className="w-full" />
        )}

        {status !== "failed" && percentage !== null && (
          <p className="text-sm font-bold text-muted-foreground">{percentage}%</p>
        )}

        <div className="h-6">
          <AnimatePresence mode="wait">
            <motion.p
              key={status === "failed" ? "error" : getMessage(percentage)}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.01 : 0.2 }}
              className="text-center text-sm text-muted-foreground"
            >
              {status === "failed"
                ? "We couldn't finish importing your posts."
                : getMessage(percentage)}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="w-full rounded-[var(--radius-md)] border-2 border-foreground/10 bg-background/70 px-4 py-3 text-sm shadow-[var(--shadow-default)]">
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              {stageLabel ?? "Preparing import"}
            </p>
            {lastUpdatedLabel && (
              <p className="text-muted-foreground">
                Last update {lastUpdatedLabel}.
              </p>
            )}
            {status === "failed" && currentJob.last_error_message && (
              <p className="text-destructive">
                {currentJob.last_error_message}
              </p>
            )}
          </div>
          {staleMessage && (
            <div className="mt-3 rounded-[var(--radius-sm)] border border-amber-400/40 bg-amber-100/70 px-3 py-2 text-amber-950">
              {staleMessage}
            </div>
          )}
        </div>

        {status === "failed" && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0.01 }
                : { delay: 0.2, ...springBounce }
            }
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
