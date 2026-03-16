export default function LoadingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="font-heading text-2xl font-bold">
        Analyzing your posts...
      </h1>
      <p className="text-muted-foreground">This may take a moment.</p>
    </div>
  );
}
