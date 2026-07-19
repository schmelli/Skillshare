import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getMembers: vi.fn(),
  };
});

const { getMembers } = await import("@/lib/api");
const { MemberRoleTable } = await import("@/components/member-role-table");

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("MemberRoleTable", () => {
  afterEach(() => {
    vi.mocked(getMembers).mockReset();
  });

  it("renders the generic error banner with a Retry action on fetch failure", async () => {
    vi.mocked(getMembers).mockRejectedValue(new Error("network down"));

    renderWithClient(
      <MemberRoleTable workspaceId="ws-1" workspaceName="Employment Law" />,
    );

    const error = await screen.findByTestId("member-table-error");
    expect(error.textContent).toContain(
      "Something went wrong. Please try again — if this keeps happening, contact your admin.",
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("shows the 'No members yet.' empty state with the Grant access CTA", async () => {
    vi.mocked(getMembers).mockResolvedValue({ members: [] });

    renderWithClient(
      <MemberRoleTable workspaceId="ws-1" workspaceName="Employment Law" />,
    );

    const empty = await screen.findByTestId("member-table-empty-state");
    expect(empty.textContent).toContain("No members yet.");
    expect(
      screen.getByRole("button", { name: /grant access/i }),
    ).toBeTruthy();
  });

  it("renders one row per member with a role badge, and truncates long name/email but never the badge", async () => {
    const longName = "A".repeat(200);
    const longEmail = `${"b".repeat(200)}@example.com`;
    vi.mocked(getMembers).mockResolvedValue({
      members: [
        {
          userId: "u1",
          name: longName,
          email: longEmail,
          role: "admin",
        },
        {
          userId: "u2",
          name: "Editor Person",
          email: "editor@example.com",
          role: "editor",
        },
      ],
    });

    renderWithClient(
      <MemberRoleTable workspaceId="ws-1" workspaceName="Employment Law" />,
    );

    const rows = await screen.findByTestId("member-table-rows");
    expect(rows.children).toHaveLength(2);

    const nameEl = screen.getByTitle(longName);
    expect(nameEl.className).toContain("truncate");
    const emailEl = screen.getByTitle(longEmail);
    expect(emailEl.className).toContain("truncate");

    const adminBadge = screen.getByText("Admin");
    expect(adminBadge.className).not.toContain("truncate");
    expect(screen.getByText("Editor")).toBeTruthy();
  });

  it("opens the Remove member confirmation dialog with the exact UI-SPEC copy", async () => {
    vi.mocked(getMembers).mockResolvedValue({
      members: [
        {
          userId: "u1",
          name: "Jane Lawyer",
          email: "jane@example.com",
          role: "editor",
        },
      ],
    });

    renderWithClient(
      <MemberRoleTable workspaceId="ws-1" workspaceName="Employment Law" />,
    );

    await screen.findByTestId("member-table-rows");
    fireEvent.click(screen.getByRole("button", { name: /remove member/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain(
      "Remove Jane Lawyer from Employment Law? They'll lose access to every skill in this workspace immediately.",
    );
    expect(
      screen.getByRole("button", { name: /^cancel$/i }),
    ).toBeTruthy();
    expect(
      screen.getByTestId("confirm-remove-member").textContent,
    ).toContain("Remove");
  });
});
