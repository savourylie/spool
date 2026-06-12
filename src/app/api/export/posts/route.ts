import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/server";
import {
  buildPostsExportCsv,
  type ExportPostRow,
} from "@/lib/posts-export";

export async function GET(request: NextRequest) {
  const userId = getSession(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = (await supabase.rpc(
    "export_posts_with_latest_metrics" as never,
    { p_user_id: userId } as never,
  )) as unknown as {
    data: ExportPostRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Posts export failed:", error.message);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  const csv = buildPostsExportCsv(data ?? []);
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="spool-posts-export-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
