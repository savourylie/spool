import {
  StickerCard,
  StickerCardHeader,
  StickerCardContent,
} from "@/components/ui/card";
import { SemanticFocusSkeleton } from "@/components/dashboard/semantic-focus";
import { AudienceFitSkeleton } from "@/components/dashboard/audience-fit";

function GenericCardSkeleton() {
  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardHeader>
        <div aria-hidden="true" className="flex flex-col gap-2">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        </div>
      </StickerCardHeader>
      <StickerCardContent>
        <div aria-hidden="true" className="flex flex-col gap-3">
          <div className="h-[200px] w-full animate-pulse rounded bg-muted" />
        </div>
      </StickerCardContent>
    </StickerCard>
  );
}

export default function AudienceLoading() {
  return (
    <div role="status" aria-label="Loading audience data">
      {/* Follower Chart skeleton */}
      <GenericCardSkeleton />
      {/* Demographics Charts skeleton */}
      <GenericCardSkeleton />
      {/* Semantic Focus skeleton */}
      <SemanticFocusSkeleton />
      {/* Audience Fit skeleton */}
      <AudienceFitSkeleton />
    </div>
  );
}
