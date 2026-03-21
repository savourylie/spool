import {
  StickerCard,
  StickerCardHeader,
  StickerCardContent,
} from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div aria-label="Loading dashboard content" role="status">
      <StickerCard className="hover:rotate-0 hover:scale-100">
        <StickerCardHeader>
          <div aria-hidden="true" className="flex flex-col gap-2">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          </div>
        </StickerCardHeader>
        <StickerCardContent>
          <div aria-hidden="true" className="flex flex-col gap-3">
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </StickerCardContent>
      </StickerCard>
    </div>
  );
}
