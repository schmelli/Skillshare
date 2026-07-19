import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMembers, type MemberListItem } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GrantRoleForm } from "@/components/grant-role-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const GENERIC_ERROR_COPY =
  "Something went wrong. Please try again — if this keeps happening, contact your admin.";

// The workspace's own member table (Admin viewer only — the route itself is
// gated Admin-only server-side via WorkspaceRoleGuard, so every viewer who
// reaches this component is already an Admin of `workspaceId`).
function EmptyState({
  workspaceId,
  onGranted,
}: {
  workspaceId: string;
  onGranted: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 py-16 text-center"
      data-testid="member-table-empty-state"
    >
      <h2 className="text-xl font-semibold">No members yet.</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Grant a role to add the first person to this workspace.
      </p>
      <GrantRoleForm
        workspaceId={workspaceId}
        onGranted={onGranted}
        className="mt-2"
      />
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      data-testid="member-table-error"
      className="flex flex-col items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4"
    >
      <p className="text-sm text-destructive">{GENERIC_ERROR_COPY}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function RoleBadge({ role }: { role: MemberListItem["role"] }) {
  // Fixed 3-word vocabulary (Admin/Editor/Consumer) — the badge itself never
  // truncates (UI-SPEC overflow row); only the name/email cell beside it does.
  if (role === "admin") {
    return (
      <Badge className="shrink-0 bg-[#4F46E5] text-white hover:bg-[#4F46E5]/90">
        Admin
      </Badge>
    );
  }
  const label = role === "editor" ? "Editor" : "Consumer";
  return (
    <Badge variant="secondary" className="shrink-0">
      {label}
    </Badge>
  );
}

// No DELETE /api/workspaces/:workspaceId/members/:userId route exists yet —
// removing a member is explicitly flagged in the UI-SPEC as a proactive
// addition, not a Phase 1 requirement (only granting a role, ORG-02, is in
// scope here). This dialog renders the exact UI-SPEC confirmation copy so
// the affordance is discoverable/reviewable now, but confirming does not
// call any API — see SUMMARY.md's "Known Stubs" for the follow-up.
function RemoveMemberDialog({
  member,
  workspaceName,
  open,
  onOpenChange,
}: {
  member: MemberListItem;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove member</DialogTitle>
          <DialogDescription>
            Remove {member.name} from {workspaceName}? They&apos;ll lose
            access to every skill in this workspace immediately.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            data-testid="confirm-remove-member"
            onClick={() => onOpenChange(false)}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function summaryCopy(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

export function MemberRoleTable({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<MemberListItem | null>(
    null,
  );

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => getMembers(workspaceId),
  });

  const handleGranted = () => {
    void queryClient.invalidateQueries({
      queryKey: ["members", workspaceId],
    });
  };

  if (isPending) {
    return (
      <p
        data-testid="member-table-loading"
        className="py-8 text-sm text-muted-foreground"
      >
        Loading members…
      </p>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  const { members } = data;

  if (members.length === 0) {
    return (
      <EmptyState workspaceId={workspaceId} onGranted={handleGranted} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p
          className="text-sm text-muted-foreground"
          data-testid="member-summary"
        >
          {summaryCopy(members.length)}
        </p>
        <GrantRoleForm workspaceId={workspaceId} onGranted={handleGranted} />
      </div>
      <ul className="flex flex-col gap-2" data-testid="member-table-rows">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex items-center justify-between gap-4 rounded-md border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-base" title={member.name}>
                {member.name}
              </p>
              <p
                className="truncate text-sm text-muted-foreground"
                title={member.email}
              >
                {member.email}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <RoleBadge role={member.role} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRemoveTarget(member)}
              >
                Remove member
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {removeTarget && (
        <RemoveMemberDialog
          member={removeTarget}
          workspaceName={workspaceName}
          open={!!removeTarget}
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null);
          }}
        />
      )}
    </div>
  );
}
