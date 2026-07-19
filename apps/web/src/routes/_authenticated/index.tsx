import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/lib/api";

// The Walking Skeleton's health landing (Plan 02), moved under the
// `_authenticated` guarded layout (Plan 03) — reaching the dashboard now
// requires a valid session.
export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold">Skillshare</h1>
      {isPending && (
        <p className="text-sm text-muted-foreground">
          Connecting to API…
        </p>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          API connection failed — is the API running on :3000?
        </p>
      )}
      {data && (
        <p className="text-sm text-muted-foreground" data-testid="health-status">
          API connected — {data.tenantCount} tenant(s)
        </p>
      )}
    </main>
  );
}
