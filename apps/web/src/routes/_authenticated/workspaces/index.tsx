import { createFileRoute } from "@tanstack/react-router";
import { AppNav } from "@/components/app-nav";
import { WorkspaceList } from "@/components/workspace-list";

// Nested under the `_authenticated` pathless layout (Plan 03's
// beforeLoad session guard) so this route inherits the redirect-when-
// logged-out behavior automatically, matching the established
// `_authenticated/index.tsx` convention.
export const Route = createFileRoute("/_authenticated/workspaces/")({
  component: WorkspacesPage,
});

export function WorkspacesPage() {
  return (
    <div className="flex min-h-screen">
      <AppNav />
      <main className="flex-1 p-8">
        <h1 className="mb-6 text-2xl font-semibold">Workspaces</h1>
        <WorkspaceList />
      </main>
    </div>
  );
}
