import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
} from "@/components/ui/card";

export default function PostsPage() {
  return (
    <StickerCard>
      <StickerCardHeader>
        <StickerCardTitle>Post Performance</StickerCardTitle>
        <StickerCardDescription>
          Your post analytics will appear here once data has been loaded.
        </StickerCardDescription>
      </StickerCardHeader>
    </StickerCard>
  );
}
