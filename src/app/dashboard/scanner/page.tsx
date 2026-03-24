import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getScannerEmptyStateCopy } from "@/lib/dashboard-empty-state-copy";

export default function ScannerPage() {
  const copy = getScannerEmptyStateCopy();

  return (
    <StickerCard className="pt-8">
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
        <EmptyState
          icon={<MagnifyingGlass weight="bold" className="size-7" />}
          iconColor="quaternary"
          title={copy.title}
          description={copy.description}
        />
      </StickerCardContent>
    </StickerCard>
  );
}
