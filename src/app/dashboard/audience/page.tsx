import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
} from "@/components/ui/card";

export default function AudiencePage() {
  return (
    <StickerCard>
      <StickerCardHeader>
        <StickerCardTitle>Audience Snapshot</StickerCardTitle>
        <StickerCardDescription>
          Your audience demographics and growth data will appear here.
        </StickerCardDescription>
      </StickerCardHeader>
    </StickerCard>
  );
}
