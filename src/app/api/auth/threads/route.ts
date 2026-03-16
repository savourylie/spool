import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/threads";
import { OAUTH_STATE_COOKIE_NAME } from "@/lib/session";

export async function GET() {
  const state = crypto.randomUUID();
  const authUrl = getAuthorizationUrl(state);

  const response = NextResponse.redirect(authUrl);

  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
