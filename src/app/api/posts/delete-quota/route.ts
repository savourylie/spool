import { type NextRequest, NextResponse } from "next/server";

import { getDeleteQuotaForUser } from "@/lib/post-delete";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest): Promise<Response> {
  const userId = getSession(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getDeleteQuotaForUser(userId));
  } catch (error) {
    // Log the message only. An error object can carry request details.
    const reason = error instanceof Error ? error.message : "Unknown error";
    console.error(`Delete quota check failed: ${reason}`);
    return NextResponse.json({ error: "quota_check_failed" }, { status: 500 });
  }
}
