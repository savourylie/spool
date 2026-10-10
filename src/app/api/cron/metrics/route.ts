import { NextResponse } from "next/server";
import { refreshAllUsers } from "@/lib/metrics-refresh";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshAllUsers();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cron metrics refresh failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
