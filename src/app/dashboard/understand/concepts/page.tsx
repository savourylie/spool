import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Books } from "@phosphor-icons/react/dist/ssr/Books";

import { ConceptLibraryTable } from "@/components/dashboard/concept-library-table";
import { ErrorState } from "@/components/ui/error-state";
import {
  StickerCard,
  StickerCardContent,
  StickerCardDescription,
  StickerCardHeader,
  StickerCardIcon,
  StickerCardTitle,
} from "@/components/ui/card";
import { fetchConceptLibraryRows } from "@/lib/concept-library-view";
import { SESSION_COOKIE_NAME } from "@/lib/session";

export const metadata: Metadata = { title: "Concept Library - Spool" };

export const dynamic = "force-dynamic";

export default async function ConceptsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  if (!session) redirect("/");

  let rows: Awaited<ReturnType<typeof fetchConceptLibraryRows>>;
  try {
    rows = await fetchConceptLibraryRows(session.value);
  } catch {
    return <ErrorState description="We couldn't load your concept library right now." />;
  }

  return (
    <div className="py-8">
      <StickerCard className="pt-8 hover:rotate-0 hover:scale-100">
        <StickerCardIcon color="quaternary">
          <Books weight="fill" className="size-6" />
        </StickerCardIcon>
        <StickerCardHeader>
          <StickerCardTitle>Concept Library</StickerCardTitle>
          <StickerCardDescription>
            Search the ideas and analogies you have already explained.
          </StickerCardDescription>
        </StickerCardHeader>
        <StickerCardContent>
          <ConceptLibraryTable rows={rows} />
        </StickerCardContent>
      </StickerCard>
    </div>
  );
}
