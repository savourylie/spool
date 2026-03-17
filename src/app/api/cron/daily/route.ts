import { NextResponse } from "next/server";
import { refreshAllDailyStats } from "@/lib/daily-stats";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshAllDailyStats();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron daily stats refresh failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
