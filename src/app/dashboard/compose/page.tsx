import { PencilLine } from "@phosphor-icons/react/dist/ssr/PencilLine";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getComposerEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";

export default function ComposePage() {
  const copy = getComposerEmptyStateCopy();

  return (
    <StickerCard className="pt-8">
      <StickerCardIcon color="primary">
        <PencilLine weight="fill" className="size-6" />
      </StickerCardIcon>
      <StickerCardHeader>
        <StickerCardTitle>AI Composer</StickerCardTitle>
        <StickerCardDescription>
          Draft algorithm-optimized posts powered by your own performance data.
        </StickerCardDescription>
      </StickerCardHeader>
      <StickerCardContent>
        <EmptyState
          icon={<PencilLine weight="bold" className="size-7" />}
          iconColor="primary"
          title={copy.title}
          description={copy.description}
        />
      </StickerCardContent>
    </StickerCard>
  );
}
