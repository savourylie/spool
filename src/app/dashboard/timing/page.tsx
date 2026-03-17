import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
} from "@/components/ui/card";

export default function TimingPage() {
  return (
    <StickerCard>
      <StickerCardHeader>
        <StickerCardTitle>Best Time to Post</StickerCardTitle>
        <StickerCardDescription>
          Your optimal posting times will appear here once enough data has been
          collected.
        </StickerCardDescription>
      </StickerCardHeader>
    </StickerCard>
  );
}
