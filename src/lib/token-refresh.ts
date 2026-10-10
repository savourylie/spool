import { createAdminClient } from "@/lib/supabase/server";
import { ThreadsAPI } from "@/lib/threads-api";
import { decrypt, encrypt } from "@/lib/crypto";

const REFRESH_WINDOW_DAYS = 15;

export async function refreshTokenForUser(userId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("access_token, token_expires_at")
    .eq("id", userId)
    .single();

  if (userError || !user) throw userError ?? new Error("User not found");

  const expiresAt = new Date(user.token_expires_at);
  const now = new Date();

  if (expiresAt <= now) {
    console.warn(`Skipping user ${userId}: token already expired`);
    return false;
  }

  const refreshThreshold = new Date(
    now.getTime() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  if (expiresAt > refreshThreshold) {
    return false;
  }

  const decryptedToken = decrypt(user.access_token);
  const result = await ThreadsAPI.refreshToken(decryptedToken);
  const encryptedToken = encrypt(result.access_token);

  const newExpiresAt = new Date(
    now.getTime() + result.expires_in * 1000,
  ).toISOString();

  const { error: updateError } = await supabase
    .from("users")
    .update({
      access_token: encryptedToken,
      token_expires_at: newExpiresAt,
    })
    .eq("id", userId);

  if (updateError) throw updateError;

  console.log(`Refreshed token for user ${userId}, new expiry: ${newExpiresAt}`);
  return true;
}

export async function refreshAllTokens(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
}> {
  const supabase = createAdminClient();

  const refreshThreshold = new Date(
    Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: users, error } = await supabase
    .from("users")
    .select("id")
    .gt("token_expires_at", new Date().toISOString())
    .lte("token_expires_at", refreshThreshold);

  if (error) throw error;

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users ?? []) {
    try {
      const refreshed = await refreshTokenForUser(user.id);
      if (refreshed) {
        processed++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`Failed to refresh token for user ${user.id}:`, err);
      errors++;
    }
  }

  console.log(
    `Token refresh complete: ${processed} refreshed, ${skipped} skipped, ${errors} errors`,
  );
  return { processed, skipped, errors };
}
