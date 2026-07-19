import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppNav } from "@/components/app-nav";
import { MemberRoleTable } from "@/components/member-role-table";
import { getWorkspaces } from "@/lib/api";

// Nested under the `_authenticated` pathless layout (same convention as
// `_authenticated/workspaces/index.tsx`, Plan 04) so this route inherits the
// redirect-when-logged-out guard automatically. The plan's own files_modified
// listed this at `apps/web/src/routes/workspaces/$workspaceId.tsx`, but its
// own prose says "member detail route under _authenticated" — the literal
// path contradicts the prose, same reconciliation Plan 04 already made for
// `workspaces/index.tsx` (deviation, see SUMMARY.md).
export const Route = createFileRoute(
  "/_authenticated/workspaces/$workspaceId",
)({
  component: WorkspaceMembersPage,
});

export function WorkspaceMembersPage() {
  const { workspaceId } = Route.useParams();
  // Reuses the same `["workspaces"]` query AppNav/WorkspaceList already
  // populate, to resolve this workspace's display name for the "Remove
  // member" confirmation copy — no separate get-one-workspace endpoint
  // exists (or is needed) for this.
  const { data } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getWorkspaces,
  });
  const workspaceName =
    data?.workspaces.find((w) => w.id === workspaceId)?.name ??
    "this workspace";

  return (
    <div className="flex min-h-screen">
      <AppNav />
      <main className="flex-1 p-8">
        <h1 className="mb-6 text-2xl font-semibold">Members</h1>
        <MemberRoleTable
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />
      </main>
    </div>
  );
}
