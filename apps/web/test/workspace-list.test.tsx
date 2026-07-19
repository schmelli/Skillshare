import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getWorkspaces: vi.fn(),
  };
});

const { getWorkspaces } = await import("@/lib/api");
const { WorkspaceList } = await import("@/components/workspace-list");

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("WorkspaceList", () => {
  afterEach(() => {
    vi.mocked(getWorkspaces).mockReset();
  });

  it("renders skeleton rows while the initial fetch is in flight (loading backstop)", () => {
    vi.mocked(getWorkspaces).mockImplementation(
      () => new Promise(() => {}),
    );

    renderWithClient(<WorkspaceList />);

    expect(screen.getByTestId("workspace-list-loading")).toBeTruthy();
  });

  it("renders the generic error banner with a Retry action on fetch failure", async () => {
    vi.mocked(getWorkspaces).mockRejectedValue(new Error("network down"));

    renderWithClient(<WorkspaceList />);

    const error = await screen.findByTestId("workspace-list-error");
    expect(error.textContent).toContain(
      "Something went wrong. Please try again — if this keeps happening, contact your admin.",
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();
  });

  it("shows the bootstrap empty state with the Create workspace CTA when canCreate is true", async () => {
    vi.mocked(getWorkspaces).mockResolvedValue({
      workspaces: [],
      canCreate: true,
    });

    renderWithClient(<WorkspaceList />);

    await screen.findByText("Create your first workspace.");
    expect(
      screen.getByRole("button", { name: /create workspace/i }),
    ).toBeTruthy();
  });

  it("shows the no-access empty state with no CTA when canCreate is false", async () => {
    vi.mocked(getWorkspaces).mockResolvedValue({
      workspaces: [],
      canCreate: false,
    });

    renderWithClient(<WorkspaceList />);

    await screen.findByTestId("no-workspaces-empty-state");
    expect(screen.getByText("No workspaces yet.")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /create workspace/i }),
    ).toBeNull();
  });

  it("uses singular/plural summary copy for the authorized count", async () => {
    vi.mocked(getWorkspaces).mockResolvedValue({
      workspaces: [
        { id: "1", name: "Solo", role: "admin", createdAt: "2026-01-01" },
      ],
      canCreate: true,
    });

    renderWithClient(<WorkspaceList />);

    const summary = await screen.findByTestId("workspace-summary");
    expect(summary.textContent).toBe("1 workspace");
  });

  it("truncates long workspace names with ellipsis and exposes the full name via title (overflow)", async () => {
    const longName = "A".repeat(120);
    vi.mocked(getWorkspaces).mockResolvedValue({
      workspaces: [
        { id: "1", name: longName, role: "editor", createdAt: "2026-01-01" },
      ],
      canCreate: true,
    });

    renderWithClient(<WorkspaceList />);

    const nameEl = await screen.findByTitle(longName);
    expect(nameEl.className).toContain("truncate");
  });

  it("gives the Admin badge the accent color while Editor/Consumer use the neutral palette", async () => {
    vi.mocked(getWorkspaces).mockResolvedValue({
      workspaces: [
        { id: "1", name: "A", role: "admin", createdAt: "2026-01-01" },
        { id: "2", name: "B", role: "editor", createdAt: "2026-01-01" },
        { id: "3", name: "C", role: "consumer", createdAt: "2026-01-01" },
      ],
      canCreate: true,
    });

    renderWithClient(<WorkspaceList />);

    const adminBadge = await screen.findByText("Admin");
    expect(adminBadge.className).toContain("#4F46E5");
    const editorBadge = await screen.findByText("Editor");
    expect(editorBadge.className).not.toContain("#4F46E5");
    const consumerBadge = await screen.findByText("Consumer");
    expect(consumerBadge.className).not.toContain("#4F46E5");
  });
});
