import { test, expect, request as playwrightRequest } from "@playwright/test";
import { API_ORIGIN, WEB_ORIGIN } from "../playwright.config";

// ORG-03 (UI half): a user who is a member of only workspace A must see A in
// the dashboard's workspace nav and never see workspace B — the same
// deny-by-default contract the API enforces server-side
// (WorkspaceRoleGuard), exercised here through the real browser UI so the
// dashboard's own rendering is proven, not just the API response shape.
// Setup (registering users, creating workspaces, granting the role) goes
// straight at the API (`API_ORIGIN`) via Playwright's `request` fixture —
// bypassing vite.config.ts's dev proxy entirely, for the same
// worktree-isolation reason `playwright.config.ts` derives its own unique
// port pair. Only the actual assertion (what the member sees after logging
// in) drives the real browser, against `baseURL` (`WEB_ORIGIN`).
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

    await request.post(`${API_ORIGIN}/api/auth/sign-up/email`, {
      headers: { Origin: WEB_ORIGIN },
      data: { email: adminEmail, password: PASSWORD, name: "PW Admin" },
    });
    await request.post(`${API_ORIGIN}/api/auth/sign-in/email`, {
      headers: { Origin: WEB_ORIGIN },
      data: { email: adminEmail, password: PASSWORD },
    });

    const workspaceARes = await request.post(`${API_ORIGIN}/api/workspaces`, {
      headers: { Origin: WEB_ORIGIN },
      data: { name: workspaceAName },
    });
    expect(workspaceARes.ok()).toBe(true);
    const workspaceA = await workspaceARes.json();

    const workspaceBRes = await request.post(`${API_ORIGIN}/api/workspaces`, {
      headers: { Origin: WEB_ORIGIN },
      data: { name: workspaceBName },
    });
    expect(workspaceBRes.ok()).toBe(true);

    // Registers via an ISOLATED APIRequestContext, not the shared `request`
    // fixture the admin is using above — better-auth's sign-up response
    // also sets a session cookie (auto-login), and since the shared
    // `request` fixture is a single cookie jar for the whole test, signing
    // the member up through it would silently clobber the admin's own
    // session cookie for that domain, causing every subsequent "admin"
    // call (the grant, below) to actually run as the member instead.
    const memberSetupContext = await playwrightRequest.newContext();
    await memberSetupContext.post(`${API_ORIGIN}/api/auth/sign-up/email`, {
      headers: { Origin: WEB_ORIGIN },
      data: { email: memberEmail, password: PASSWORD, name: "PW Member" },
    });
    await memberSetupContext.dispose();

    // Admin grants the member an `editor` role in workspace A only — never
    // in workspace B. Still uses the original `request` fixture, whose
    // cookie jar holds only the admin's own session.
    const grantRes = await request.post(
      `${API_ORIGIN}/api/workspaces/${workspaceA.id}/members`,
      {
        headers: { Origin: WEB_ORIGIN },
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
