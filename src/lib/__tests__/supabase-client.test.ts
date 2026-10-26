import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:55321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
});

describe("browser Supabase client", () => {
  it("never persists or auto-refreshes a Supabase Auth session", async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const client = createClient();
    // These flags are protected on GoTrueClient, but they are exactly what the
    // stale-cookie refresh path keys off, so assert on them directly.
    const auth = client.auth as unknown as {
      persistSession: boolean;
      autoRefreshToken: boolean;
      detectSessionInUrl: boolean;
    };

    // Spool authenticates with its own session cookie, so a stored Supabase
    // session can only ever be stale — reading one produces
    // "Invalid Refresh Token: Refresh Token Not Found" on every page load.
    expect(auth.persistSession).toBe(false);
    expect(auth.autoRefreshToken).toBe(false);
    expect(auth.detectSessionInUrl).toBe(false);
  });

  it("returns one shared instance so Realtime keeps a single connection", async () => {
    const { createClient } = await import("@/lib/supabase/client");

    expect(createClient()).toBe(createClient());
  });
});
