import { test, expect } from "@playwright/test";

// ORG-03 (UI half): a user who is a member of only workspace A must see A in
// the dashboard's workspace nav and never see workspace B — the same
// deny-by-default contract the API enforces server-side
// (WorkspaceRoleGuard), exercised here through the real browser UI so the
// dashboard's own rendering is proven, not just the API response shape.
// Setup (registering users, creating workspaces, granting the role) goes
// through the API directly via Playwright's `request` fixture for speed;
// only the actual assertion (what the member sees after logging in) drives
// the real browser.
const ORIGIN = "http://localhost:5173";
const PASSWORD = "Correct-Horse-Battery-Staple-1";

test.describe("workspace visibility (cross-workspace isolation)", () => {
  test("a member of only workspace A sees A in the nav and never sees B", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const adminEmail = `pw-admin-${stamp}@example.com`;
    const memberEmail = `pw-member-${stamp}@example.com`;
    const workspaceAName = `PW Visibility A ${stamp}`;
    const workspaceBName = `PW Visibility B ${stamp}`;

    await request.post("/api/auth/sign-up/email", {
      headers: { Origin: ORIGIN },
      data: { email: adminEmail, password: PASSWORD, name: "PW Admin" },
    });
    await request.post("/api/auth/sign-in/email", {
      headers: { Origin: ORIGIN },
      data: { email: adminEmail, password: PASSWORD },
    });

    const workspaceARes = await request.post("/api/workspaces", {
      headers: { Origin: ORIGIN },
      data: { name: workspaceAName },
    });
    expect(workspaceARes.ok()).toBe(true);
    const workspaceA = await workspaceARes.json();

    const workspaceBRes = await request.post("/api/workspaces", {
      headers: { Origin: ORIGIN },
      data: { name: workspaceBName },
    });
    expect(workspaceBRes.ok()).toBe(true);

    await request.post("/api/auth/sign-up/email", {
      headers: { Origin: ORIGIN },
      data: { email: memberEmail, password: PASSWORD, name: "PW Member" },
    });

    // Admin grants the member an `editor` role in workspace A only — never
    // in workspace B.
    const grantRes = await request.post(
      `/api/workspaces/${workspaceA.id}/members`,
      {
        headers: { Origin: ORIGIN },
        data: { targetEmail: memberEmail, role: "editor" },
      },
    );
    expect(grantRes.ok()).toBe(true);

    // Log in as the member through the real login form (a fresh browser
    // context, unrelated to the `request` fixture's admin cookie jar).
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(memberEmail);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL((url) => url.pathname === "/");

    await page.goto("/workspaces");
    const nav = page.getByTestId("app-nav-workspace-list");
    await expect(nav.getByText(workspaceAName)).toBeVisible();
    await expect(nav.getByText(workspaceBName)).toHaveCount(0);
    // The unauthorized workspace's name must never even reach the client —
    // not just be hidden by a CSS/DOM filter.
    await expect(page.locator("body")).not.toContainText(workspaceBName);
  });
});
