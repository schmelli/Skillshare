import { useQuery } from "@tanstack/react-query";
import { getWorkspaces } from "@/lib/api";

// Sidebar workspace-nav: renders the caller's authorized workspaces (same
// deny-by-default GET /api/workspaces query as WorkspaceList). Becomes
// internally scrollable past ~10 entries rather than pushing page content
// down (UI-SPEC overflow backstop) — `max-h-96 overflow-y-auto` on the list
// itself, not the whole sidebar. Entries are inert for now; Plan 05 wires
// each one to its workspace detail route ($workspaceId.tsx) and adds the
// active/selected accent indicator once that route exists.
export function AppNav() {
  const { data } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getWorkspaces,
  });

  const workspaces = data?.workspaces ?? [];

  return (
    <nav
      aria-label="Workspaces"
      className="w-64 shrink-0 border-r bg-[#F4F4F5] p-4"
    >
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">
        Workspaces
      </h2>
      <ul
        data-testid="app-nav-workspace-list"
        className="flex max-h-96 flex-col gap-1 overflow-y-auto"
      >
        {workspaces.map((workspace) => (
          <li key={workspace.id}>
            <span
              className="block truncate rounded-md px-2 py-1.5 text-sm"
              title={workspace.name}
            >
              {workspace.name}
            </span>
          </li>
        ))}
      </ul>
    </nav>
  );
}
