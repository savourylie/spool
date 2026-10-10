import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";

import { createAdminClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import type { HistoricalPost } from "@/lib/engagement-prediction";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import {
  QualityScanner,
  type ScannerPost,
} from "@/components/dashboard/quality-scanner";

export const metadata: Metadata = { title: "Content Scanner — Spool" };

export default async function CreateScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  const params = await searchParams;
  const initialText = params.text ?? "";

  const supabase = createAdminClient();
  const userId = session.value;

  const [scannerResult, predictionResult] = await Promise.all([
    supabase
      .from("posts")
      .select("id, text_preview, text_full, published_at")
      .eq("user_id", userId)
      .not("text_full", "is", null)
      .order("published_at", { ascending: false })
      .limit(50),
    supabase.rpc("get_posts_with_metrics", {
      p_user_id: userId,
      p_limit: 500,
      p_offset: 0,
      p_sort_column: "published_at",
      p_sort_order: "desc",
    }),
  ]);

  const posts: ScannerPost[] = (scannerResult.data ?? []).map((p) => ({
    id: p.id,
    text_preview: p.text_preview,
    text_full: p.text_full,
    published_at: p.published_at,
  }));

  const predictionPosts: HistoricalPost[] = (predictionResult.data ?? []).map(
    (p) => ({
      views: p.views,
      media_type: p.media_type,
      text_length: (p.text_preview ?? "").length,
      published_at: p.published_at,
      topic_tag: null,
    }),
  );

  const scannerV2 = process.env.SCANNER_V2_ENABLED === "true";

  if (scannerV2) {
    return (
      <div className="py-8">
        <h1 className="font-heading text-3xl font-medium">Content Scanner</h1>
        <p className="mt-2 text-muted-foreground">
          Four-axis diagnostic: style match, psychology, algorithm alignment,
          and AI-tone detection. Scanner diagnoses; Composer rewrites.
        </p>
        <div className="mt-8">
          <QualityScanner
            posts={posts}
            predictionPosts={predictionPosts}
            initialText={initialText}
            scannerV2
          />
        </div>
      </div>
    );
  }

  return (
    <StickerCard className="pt-8 hover:rotate-0 hover:scale-100">
      <StickerCardIcon color="quaternary">
        <MagnifyingGlass weight="fill" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>Content Scanner</StickerCardTitle>
        <StickerCardDescription>
          Check your posts for algorithm-demoted patterns before publishing.
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        <QualityScanner
          posts={posts}
          predictionPosts={predictionPosts}
          initialText={initialText}
        />
      </StickerCardContent>
    </StickerCard>
  );
}
