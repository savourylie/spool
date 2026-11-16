import { PostSelectionProvider } from "@/components/dashboard/post-selection-provider";

// A layout stays mounted while the page, sort, or filter search params change,
// so the selection kept by this provider survives all of them.
export default function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PostSelectionProvider>{children}</PostSelectionProvider>;
}
