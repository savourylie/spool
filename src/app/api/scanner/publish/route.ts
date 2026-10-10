import { type NextRequest, NextResponse } from "next/server";

import type { PredictionRange } from "@/lib/engagement-prediction";
import {
  markPredictionPublished,
  snapshotPrediction,
} from "@/lib/post-review";
import { getSession } from "@/lib/session";

const MAX_TEXT_LENGTH = 2000;
const VALID_CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);

function isPredictionRange(value: unknown): value is PredictionRange {
  if (!value || typeof value !== "object") {
    return false;
  }

  const range = value as PredictionRange;
  return (
    Number.isFinite(range.p25) &&
    Number.isFinite(range.p50) &&
    Number.isFinite(range.p75) &&
    Number.isFinite(range.matchedCount) &&
    VALID_CONFIDENCE_LEVELS.has(range.confidence)
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { text?: string; range?: PredictionRange };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters` },
      { status: 400 },
    );
  }

  if (!isPredictionRange(body.range)) {
    return NextResponse.json(
      { error: "A valid prediction range is required" },
      { status: 400 },
    );
  }

  try {
    const predictionId = await snapshotPrediction({
      userId,
      draftText: text,
      ranges: body.range,
      driverFactors: {
        source: "scanner",
      },
    });

    await markPredictionPublished({
      userId,
      predictionId,
      draftText: text,
    });

    return NextResponse.json({ ok: true, predictionId });
  } catch (error) {
    console.error("Failed to mark scanner draft as published:", error);
    return NextResponse.json(
      { error: "Failed to mark text as published" },
      { status: 500 },
    );
  }
}
