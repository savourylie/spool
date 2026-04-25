import { type NextRequest, NextResponse } from "next/server";

import { fetchConceptOccurrences } from "@/lib/concept-library-view";
import { getSession } from "@/lib/session";

function safeDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ concept: string }> },
) {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { concept } = await params;
  const normalized = safeDecodePathSegment(concept).trim().toLowerCase();
  if (!normalized) {
    return NextResponse.json(
      { error: "Concept is required" },
      { status: 400 },
    );
  }

  try {
    const rows = await fetchConceptOccurrences(userId, normalized);
    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Failed to load concept posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
