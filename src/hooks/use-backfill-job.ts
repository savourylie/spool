"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
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
                  payload.new as {
                    id: string;
                    status: string;
                    processed_posts: number | null;
                    total_posts: number | null;
                  },
                ),
              );
            },
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
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
