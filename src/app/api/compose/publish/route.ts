import { type NextRequest, NextResponse } from "next/server";

import { markPredictionPublished } from "@/lib/post-review";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest): Promise<Response> {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { predictionId?: string; draftText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const predictionId =
    typeof body.predictionId === "string" ? body.predictionId.trim() : "";
  const draftText =
    typeof body.draftText === "string" ? body.draftText.trim() : "";

  if (!predictionId) {
    return NextResponse.json(
      { error: "predictionId is required" },
      { status: 400 },
    );
  }

  if (!draftText) {
    return NextResponse.json(
      { error: "draftText is required" },
      { status: 400 },
    );
  }

  try {
    await markPredictionPublished({
      userId,
      predictionId,
      draftText,
    });

    return NextResponse.json({ ok: true, predictionId });
  } catch (error) {
    console.error("Failed to mark composer draft as published:", error);
    return NextResponse.json(
      { error: "Failed to mark draft as published" },
      { status: 500 },
    );
  }
}
