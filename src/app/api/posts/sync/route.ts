import { type NextRequest, NextResponse } from "next/server";

import { refreshMetrics } from "@/lib/metrics-refresh";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest): Promise<Response> {
  const userId = getSession(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshMetrics(userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Posts sync failed:", error);
    return NextResponse.json(
      { error: "Failed to sync posts" },
      { status: 500 },
    );
  }
}
