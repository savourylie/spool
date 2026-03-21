import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <EmptyState
        icon={<MagnifyingGlass weight="bold" className="size-7" />}
        iconColor="secondary"
        title="Page not found"
        description="The page you're looking for doesn't exist or has been moved."
        action={{ label: "Back to home", href: "/" }}
      />
    </div>
  );
}
