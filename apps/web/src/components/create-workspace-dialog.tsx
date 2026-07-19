import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspaceDto, type CreateWorkspaceDto } from "@skillshare/shared";
import { createWorkspace, WorkspaceApiError } from "@/lib/api";
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

// No autosave/draft-recovery for a partially-filled form if the browser
// closes mid-entry — explicitly out of scope for Phase 1 (UI-SPEC "partial"
// row / this plan's planner_assumptions).
export function CreateWorkspaceDialog({
  onCreated,
  className,
}: {
  onCreated: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<CreateWorkspaceDto>({
    resolver: zodResolver(createWorkspaceDto),
    defaultValues: { name: "" },
  });

  const isSubmitting = form.formState.isSubmitting;

  const onSubmit = async (values: CreateWorkspaceDto) => {
    setSubmitError(null);
    try {
      await createWorkspace(values.name);
      form.reset();
      setOpen(false);
      onCreated();
    } catch (error) {
      if (error instanceof WorkspaceApiError && error.status === 409) {
        setSubmitError(
          `A workspace named '${values.name}' already exists. Choose a different name.`,
        );
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
        <Button className={className}>Create workspace</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Workspaces organize skills by practice area, like Employment Law
            or M&amp;A.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            {submitError && (
              <p
                className="text-sm text-destructive"
                role="alert"
                data-testid="create-workspace-error"
              >
                {submitError}
              </p>
            )}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workspace name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
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
                Create workspace
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
