import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { grantRoleDto, type GrantRoleDto } from "@skillshare/shared";
import { MembershipApiError, grantRole } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const GENERIC_ERROR =
  "Something went wrong. Please try again — if this keeps happening, contact your admin.";
const UNRESOLVABLE_USER_ERROR = "No user found with that email.";

// Admin-only grant flow (ORG-02). Identifies the target by email — the
// server resolves it to a userId and returns a 400 when it doesn't
// (UI-SPEC's "unresolvable user" grant-error state); a re-grant to a user
// who already has a role in this workspace is idempotent server-side
// (upsert), so this form never needs to special-case "already a member".
export function GrantRoleForm({
  workspaceId,
  onGranted,
  className,
}: {
  workspaceId: string;
  onGranted: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<GrantRoleDto>({
    resolver: zodResolver(grantRoleDto),
    defaultValues: { targetEmail: "", role: "consumer" },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: GrantRoleDto) => {
    setSubmitError(null);
    try {
      await grantRole(workspaceId, values.targetEmail, values.role);
      form.reset();
      setOpen(false);
      onGranted();
    } catch (error) {
      if (error instanceof MembershipApiError && error.status === 400) {
        setSubmitError(UNRESOLVABLE_USER_ERROR);
        return;
      }
      setSubmitError(GENERIC_ERROR);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setSubmitError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className={className}>Grant access</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant access</DialogTitle>
          <DialogDescription>
            Grant a workspace role to an existing Skillshare user by email.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4"
            noValidate
          >
            {submitError && (
              <p
                className="text-sm text-destructive"
                role="alert"
                data-testid="grant-role-error"
              >
                {submitError}
              </p>
            )}
            <FormField
              control={form.control}
              name="targetEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <FormControl>
                    <select
                      className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      {...field}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="consumer">Consumer</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting && (
                  <span
                    className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden="true"
                  />
                )}
                Grant access
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
