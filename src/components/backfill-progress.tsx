"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap"
import { WarningCircle } from "@phosphor-icons/react/dist/ssr/WarningCircle"
import { CheckCircle } from "@phosphor-icons/react/dist/ssr/CheckCircle"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Button } from "@/components/ui/button"
import { useBackfillJob } from "@/hooks/use-backfill-job"
import { getBackfillPercentage, toBackfillJob } from "@/lib/backfill-job"

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
  const shouldReduceMotion = useReducedMotion()
  const { job, retrying, retry } = useBackfillJob(
    toBackfillJob({
      id: initialJobId,
      status: initialStatus,
      processed_posts: initialProcessed ?? 0,
      total_posts: initialTotal,
    }),
  )
  const status = job?.status ?? initialStatus
  const percentage = getBackfillPercentage(job ?? null)

  // Redirect on complete
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
      // Stay on error state
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
        initial={shouldReduceMotion ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={shouldReduceMotion ? { duration: 0.01 } : springBounce}
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
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.01 : 0.2 }}
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
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0.01 } : { delay: 0.2, ...springBounce }}
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
