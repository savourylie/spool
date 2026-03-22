import { type NextRequest, NextResponse, after } from "next/server";
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchUserProfile,
} from "@/lib/threads";
import { OAUTH_STATE_COOKIE_NAME, setSessionCookie } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { runBackfill } from "@/lib/backfill";

function errorRedirect(error: string) {
  const url = new URL("/", process.env.THREADS_REDIRECT_URI!);
  url.pathname = "/";
  url.searchParams.set("error", error);
  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // 1. Check for error from Threads
  if (searchParams.has("error")) {
    return errorRedirect("access_denied");
  }

  // 2. Validate CSRF state
  const state = searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;

  if (!state || !storedState || state !== storedState) {
    return errorRedirect("state_mismatch");
  }

  const code = searchParams.get("code");
  if (!code) {
    return errorRedirect("invalid_code");
  }

  // 3. Exchange code for short-lived token
  let shortLivedToken: string;
  try {
    const result = await exchangeCodeForShortLivedToken(code);
    shortLivedToken = result.access_token;
  } catch {
    return errorRedirect("invalid_code");
  }

  // 4. Exchange for long-lived token
  let longLivedToken: string;
  let expiresIn: number;
  try {
    const result = await exchangeForLongLivedToken(shortLivedToken);
    longLivedToken = result.access_token;
    expiresIn = result.expires_in;
  } catch {
    return errorRedirect("token_exchange_failed");
  }

  // 5. Fetch user profile
  let profile: { id: string; username: string };
  try {
    profile = await fetchUserProfile(longLivedToken);
  } catch {
    return errorRedirect("profile_fetch_failed");
  }

  // 6. Calculate token expiry
  const tokenExpiresAt = new Date(
    Date.now() + expiresIn * 1000,
  ).toISOString();

  // 7. Upsert user and create backfill job
  let userId: string;
  let backfillJobId: string;
  try {
    const supabase = createAdminClient();

    const { data: user, error: upsertError } = await supabase
      .from("users")
      .upsert(
        {
          threads_user_id: profile.id,
          username: profile.username,
          access_token: encrypt(longLivedToken),
          token_expires_at: tokenExpiresAt,
        },
        { onConflict: "threads_user_id" },
      )
      .select("id")
      .single();

    if (upsertError || !user) {
      throw upsertError;
    }

    userId = user.id;

    const { data: job, error: jobError } = await supabase
      .from("backfill_jobs")
      .insert({ user_id: userId, status: "pending" })
      .select("id")
      .single();

    if (jobError || !job) {
      throw jobError;
    }

    backfillJobId = job.id;
  } catch {
    return errorRedirect("unknown");
  }

  after(async () => {
    await runBackfill(userId, backfillJobId);
  });

  // 8. Set session cookie and redirect to dashboard while backfill runs
  const dashboardUrl = new URL("/dashboard/posts", request.nextUrl.origin);
  const response = NextResponse.redirect(dashboardUrl);
  setSessionCookie(response, userId);
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);

  return response;
}
