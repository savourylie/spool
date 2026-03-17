import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPI } from "@/lib/threads-api";
import { decrypt } from "@/lib/crypto";

export async function refreshDailyStats(
  userId: string,
): Promise<{ followersCount: number; demographicsUpdated: boolean }> {
  const supabase = createAdminClient();

  // 1. Get user and check token
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("threads_user_id, access_token, token_expires_at")
    .eq("id", userId)
    .single();

  if (userError || !user) throw userError ?? new Error("User not found");

  if (new Date(user.token_expires_at) <= new Date()) {
    console.warn(`Skipping user ${userId}: token expired`);
    return { followersCount: 0, demographicsUpdated: false };
  }

  const accessToken = decrypt(user.access_token);
  const api = new ThreadsAPI(accessToken, user.threads_user_id);

  // 2. Fetch followers_count and upsert into daily_stats
  const followersCount = await api.getFollowersCount();

  const today = new Date().toISOString().split("T")[0];
  await supabase.from("daily_stats").upsert(
    {
      user_id: userId,
      date: today,
      followers_count: followersCount,
    },
    { onConflict: "user_id,date" },
  );

  // 3. Fetch demographics if followers >= 100
  let demographicsUpdated = false;

  if (followersCount >= 100) {
    for (const dimension of ["country", "city", "gender"] as const) {
      try {
        const demo = await api.getFollowerDemographics(dimension);

        for (const { key, value } of demo.values) {
          await supabase.from("demographics").upsert(
            {
              user_id: userId,
              dimension,
              key,
              value,
            },
            { onConflict: "user_id,dimension,key" },
          );
        }

        demographicsUpdated = true;
      } catch (err) {
        console.warn(`Failed to fetch ${dimension} demographics:`, err);
      }
    }
  }

  return { followersCount, demographicsUpdated };
}

export async function refreshAllDailyStats(): Promise<{
  processed: number;
  errors: number;
}> {
  const supabase = createAdminClient();

  const { data: users, error } = await supabase.from("users").select("id");

  if (error) throw error;

  let processed = 0;
  let errors = 0;

  for (const user of users ?? []) {
    try {
      const result = await refreshDailyStats(user.id);
      console.log(
        `Daily stats for user ${user.id}: ${result.followersCount} followers, demographics=${result.demographicsUpdated}`,
      );
      processed++;
    } catch (err) {
      console.error(`Failed to refresh daily stats for user ${user.id}:`, err);
      errors++;
    }
  }

  console.log(
    `Daily stats refresh complete: ${processed} users processed, ${errors} errors`,
  );
  return { processed, errors };
}
