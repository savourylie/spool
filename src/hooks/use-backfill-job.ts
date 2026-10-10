"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import {
  BACKFILL_JOB_SELECT_FIELDS,
  createBackfillJobController,
  toBackfillJob,
  type BackfillJob,
  type BackfillJobSnapshot,
} from "@/lib/backfill-job";

export function useBackfillJob(
  initialJob: BackfillJob | null,
  {
    onJobUpdate,
  }: {
    onJobUpdate?: (job: BackfillJob) => void;
  } = {},
) {
  const [supabase] = useState(() => createClient());
  const [controller] = useState(() =>
    createBackfillJobController({
      initialJob,
      subscribeToJob: (jobId, handleUpdate) => {
        const channel = supabase
          .channel(`backfill-${jobId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "backfill_jobs",
              filter: `id=eq.${jobId}`,
            },
            (payload) => {
              handleUpdate(
                toBackfillJob(
                  payload.new as Database["public"]["Tables"]["backfill_jobs"]["Row"],
                ),
              );
            },
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      },
      fetchJob: async (jobId) => {
        const { data, error } = await supabase
          .from("backfill_jobs")
          .select(BACKFILL_JOB_SELECT_FIELDS)
          .eq("id", jobId)
          .maybeSingle();

        if (error || !data) {
          return null;
        }

        return toBackfillJob(data);
      },
      retryBackfill: async () => {
        const response = await fetch("/api/backfill/retry", { method: "POST" });

        if (!response.ok) {
          throw new Error("Retry failed");
        }

        return response.json() as Promise<{ jobId: string }>;
      },
      onJobUpdate: (job) => {
        onJobUpdate?.(job);
      },
    }),
  );
  const [snapshot, setSnapshot] = useState<BackfillJobSnapshot>(() =>
    controller.getSnapshot(),
  );

  useEffect(() => controller.subscribe(setSnapshot), [controller]);

  useEffect(() => {
    controller.activateJob(initialJob);
  }, [controller, initialJob]);

  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  return {
    job: snapshot.job,
    retrying: snapshot.retrying,
    retry: () => controller.retry(),
  };
}
