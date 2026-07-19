import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    grantRole: vi.fn(),
  };
});

const { grantRole, MembershipApiError } = await import("@/lib/api");
const { GrantRoleForm } = await import("@/components/grant-role-form");

async function openDialogAndSubmit(email: string) {
  fireEvent.click(screen.getByRole("button", { name: /grant access/i }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: /grant access/i }));
  return dialog;
}

describe("GrantRoleForm", () => {
  afterEach(() => {
    vi.mocked(grantRole).mockReset();
  });

  it("shows the unresolvable-user copy for a 400 error (UI-SPEC grant-error state)", async () => {
    vi.mocked(grantRole).mockRejectedValue(
      new MembershipApiError(400, "not found", {
        message: "No user found with that email.",
      }),
    );

    render(<GrantRoleForm workspaceId="ws-1" onGranted={vi.fn()} />);
    const dialog = await openDialogAndSubmit("nobody@example.com");

    const error = await within(dialog).findByTestId("grant-role-error");
    expect(error.textContent).toBe("No user found with that email.");
  });

  it("shows the generic failure copy for a non-400 error", async () => {
    vi.mocked(grantRole).mockRejectedValue(new Error("network down"));

    render(<GrantRoleForm workspaceId="ws-1" onGranted={vi.fn()} />);
    const dialog = await openDialogAndSubmit("user@example.com");

    const error = await within(dialog).findByTestId("grant-role-error");
    expect(error.textContent).toBe(
      "Something went wrong. Please try again — if this keeps happening, contact your admin.",
    );
  });

  it("calls onGranted and closes the dialog on success", async () => {
    vi.mocked(grantRole).mockResolvedValue(undefined);
    const onGranted = vi.fn();

    render(<GrantRoleForm workspaceId="ws-1" onGranted={onGranted} />);
    await openDialogAndSubmit("user@example.com");

    await waitFor(() => expect(onGranted).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
