import { type NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";

const REVIEW_STATUSES = ["needs_review", "reviewed"] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

function isReviewStatus(value: unknown): value is ReviewStatus {
  return (
    typeof value === "string" &&
    (REVIEW_STATUSES as readonly string[]).includes(value)
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ replyId: string }> },
): Promise<Response> {
  const userId = getSession(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: { reviewStatus?: unknown } = await request
    .json()
    .catch(() => ({}));

  if (!isReviewStatus(body.reviewStatus)) {
    return NextResponse.json(
      { error: "Invalid review status" },
      { status: 400 },
    );
  }

  const { replyId } = await params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("user_replies")
    .update({ review_status: body.reviewStatus })
    .eq("id", replyId)
    .eq("user_id", userId)
    .select("id, review_status")
    .maybeSingle();

  if (error) {
    console.error("Reply review update failed:", error);
    return NextResponse.json(
      { error: "Failed to update reply" },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Reply not found" }, { status: 404 });
  }

  return NextResponse.json({ id: data.id, reviewStatus: data.review_status });
}
