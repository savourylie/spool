import { type NextRequest, NextResponse } from "next/server";

import { getDeleteQuotaForUser } from "@/lib/post-delete";
import { getSession } from "@/lib/session";

// A Supabase error is a plain `{ message, ... }` object, not an Error, so the
// message is read from anything that has a string `message`.
function getErrorMessage(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : "Unknown error";
}

export async function GET(request: NextRequest): Promise<Response> {
  const userId = getSession(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getDeleteQuotaForUser(userId));
  } catch (error) {
    // Log the message only. The thrown value can carry request details.
    console.error(`Delete quota check failed: ${getErrorMessage(error)}`);
    return NextResponse.json({ error: "quota_check_failed" }, { status: 500 });
  }
}
