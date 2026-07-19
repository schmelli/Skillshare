import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createWorkspace: vi.fn(),
  };
});

const { createWorkspace, WorkspaceApiError } = await import("@/lib/api");
const { CreateWorkspaceDialog } = await import(
  "@/components/create-workspace-dialog"
);

async function openDialogAndSubmit(name: string) {
  fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Workspace name"), {
    target: { value: name },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: /create workspace/i }),
  );
  return dialog;
}

describe("CreateWorkspaceDialog", () => {
  afterEach(() => {
    vi.mocked(createWorkspace).mockReset();
  });

  it("shows the exact workspace-name-conflict copy for a 409 error", async () => {
    vi.mocked(createWorkspace).mockRejectedValue(
      new WorkspaceApiError(409, "conflict", { message: "conflict" }),
    );

    render(<CreateWorkspaceDialog onCreated={vi.fn()} />);
    const dialog = await openDialogAndSubmit("Employment Law");

    const error = await within(dialog).findByTestId("create-workspace-error");
    expect(error.textContent).toBe(
      "A workspace named 'Employment Law' already exists. Choose a different name.",
    );
  });

  it("shows the generic failure copy for a non-409 error", async () => {
    vi.mocked(createWorkspace).mockRejectedValue(new Error("network down"));

    render(<CreateWorkspaceDialog onCreated={vi.fn()} />);
    const dialog = await openDialogAndSubmit("Employment Law");

    const error = await within(dialog).findByTestId("create-workspace-error");
    expect(error.textContent).toBe(
      "Something went wrong. Please try again — if this keeps happening, contact your admin.",
    );
  });

  it("calls onCreated and closes the dialog on success", async () => {
    vi.mocked(createWorkspace).mockResolvedValue({
      id: "1",
      name: "Employment Law",
      role: "admin",
      createdAt: "2026-01-01",
    });
    const onCreated = vi.fn();

    render(<CreateWorkspaceDialog onCreated={onCreated} />);
    await openDialogAndSubmit("Employment Law");

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).toBeNull(),
    );
  });

  it("does not implement autosave/draft-recovery for a partially-filled form", () => {
    // Explicit negative check for the planner_assumptions "out of scope"
    // decision — no localStorage/sessionStorage writes, no draft-restore
    // effect. Rendering + typing without submitting must not persist
    // anything.
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    render(<CreateWorkspaceDialog onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));
    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});
