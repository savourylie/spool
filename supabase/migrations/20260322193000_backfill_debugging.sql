ALTER TABLE backfill_jobs
  ADD COLUMN stage text,
  ADD COLUMN current_post_id text,
  ADD COLUMN last_heartbeat_at timestamptz,
  ADD COLUMN last_error_message text,
  ADD COLUMN last_error_status int,
  ADD COLUMN last_error_payload jsonb;

UPDATE backfill_jobs
SET
  stage = COALESCE(
    stage,
    CASE status
      WHEN 'pending' THEN 'pending'
      WHEN 'running' THEN 'running'
      WHEN 'complete' THEN 'complete'
      WHEN 'failed' THEN 'failed'
      ELSE 'pending'
    END
  ),
  last_heartbeat_at = COALESCE(last_heartbeat_at, completed_at, started_at, created_at, now());

ALTER TABLE backfill_jobs
  ALTER COLUMN stage SET DEFAULT 'pending',
  ALTER COLUMN stage SET NOT NULL,
  ALTER COLUMN last_heartbeat_at SET DEFAULT now(),
  ALTER COLUMN last_heartbeat_at SET NOT NULL;

CREATE TABLE backfill_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES backfill_jobs(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  stage text NOT NULL,
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_backfill_job_events_job_created
  ON backfill_job_events (job_id, created_at DESC);

ALTER TABLE backfill_job_events ENABLE ROW LEVEL SECURITY;
