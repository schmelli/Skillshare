import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold">Skillshare</h1>
      <p className="text-sm text-muted-foreground">
        Foundation scaffold — replaced by the health-check landing page in Plan 02.
      </p>
    </main>
  );
}
