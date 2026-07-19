import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getWorkspaces: vi.fn(),
  };
});

const { getWorkspaces } = await import("@/lib/api");
const { AppNav } = await import("@/components/app-nav");

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("AppNav", () => {
  it("applies internal overflow scrolling to the workspace-nav list past ~10 entries (backstop)", async () => {
    const workspaces = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      name: `Workspace ${i}`,
      role: "admin" as const,
      createdAt: "2026-01-01",
    }));
    vi.mocked(getWorkspaces).mockResolvedValue({ workspaces, canCreate: true });

    renderWithClient(<AppNav />);

    // Wait for the async query to resolve and populate the list before
    // asserting on its children (the container itself renders immediately
    // with 0 children while the fetch is in flight).
    await screen.findByText("Workspace 11");

    const list = screen.getByTestId("app-nav-workspace-list");
    expect(list.className).toContain("overflow-y-auto");
    expect(list.className).toMatch(/max-h-/);
    expect(list.children).toHaveLength(12);
  });
});
