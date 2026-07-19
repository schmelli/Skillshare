import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkspaces, type WorkspaceListItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";

export const GENERIC_ERROR_COPY =
  "Something went wrong. Please try again — if this keeps happening, contact your admin.";

// Two distinct empty states from the UI-SPEC's Copywriting Contract,
// selected by the server's `canCreate` flag (WorkspacesService.canCreateWorkspace):
// bootstrapping the very first workspace in an empty tenant, vs. a user with
// zero memberships in an already-populated tenant who must wait for an
// existing Admin to grant them access (self-service creation is Admin-only —
// hiding this CTA is UX only, the real control is the server-side 403).
function BootstrapEmptyState({ onCreated }: { onCreated: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h2 className="text-xl font-semibold">Create your first workspace.</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Workspaces organize skills by practice area, like Employment Law or
        M&amp;A. Create one to get started.
      </p>
      <CreateWorkspaceDialog onCreated={onCreated} className="mt-2" />
    </div>
  );
}

function NoAccessEmptyState() {
  return (
    <div
      className="flex flex-col items-center gap-2 py-16 text-center"
      data-testid="no-workspaces-empty-state"
    >
      <h2 className="text-xl font-semibold">No workspaces yet.</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        You haven&apos;t been granted access to any workspace. Ask an admin
        to add you.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-2" data-testid="workspace-list-loading">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-md" />
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-testid="workspace-list-error"
      className="flex flex-col items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="text-sm text-destructive">{GENERIC_ERROR_COPY}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function RoleBadge({ role }: { role: WorkspaceListItem["role"] }) {
  if (role === "admin") {
    return (
      <Badge className="bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90">
        Admin
      </Badge>
    );
  }
  const label = role === "editor" ? "Editor" : "Consumer";
  return <Badge variant="secondary">{label}</Badge>;
}

function summaryCopy(count: number): string {
  return count === 1 ? "1 workspace" : `${count} workspaces`;
}

export function WorkspaceList() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getWorkspaces,
  });

  const handleCreated = () => {
    void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
  };

  if (isPending) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const { workspaces, canCreate } = data;

  if (workspaces.length === 0) {
    return canCreate ? (
      <BootstrapEmptyState onCreated={handleCreated} />
    ) : (
      <NoAccessEmptyState />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p
          className="text-sm text-muted-foreground"
          data-testid="workspace-summary"
        >
          {summaryCopy(workspaces.length)}
        </p>
        {canCreate && <CreateWorkspaceDialog onCreated={handleCreated} />}
      </div>
      <ul className="flex flex-col gap-2">
        {workspaces.map((workspace) => (
          <li
            key={workspace.id}
            className="flex items-center justify-between gap-4 rounded-md border bg-card p-4"
          >
            <span
              className="min-w-0 flex-1 truncate text-base"
              title={workspace.name}
            >
              {workspace.name}
            </span>
            <RoleBadge role={workspace.role} />
          </li>
        ))}
      </ul>
    </div>
  );
}
