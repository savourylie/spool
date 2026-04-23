import { NextResponse } from "next/server";
import { runReviewSweep } from "@/lib/review-sweep";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runReviewSweep();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Review sweep failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
