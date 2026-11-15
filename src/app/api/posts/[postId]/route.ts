import { type NextRequest, NextResponse } from "next/server";

import { deletePostForUser } from "@/lib/post-delete";
import { getSession } from "@/lib/session";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
): Promise<Response> {
  const userId = getSession(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { postId } = await params;
  const result = await deletePostForUser(userId, postId);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ deleted: true });
}
