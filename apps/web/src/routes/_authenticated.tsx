import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

// Guarded layout route: every route nested under `_authenticated/` requires
// a valid session. Checking (and redirecting) here — not just hiding a nav
// link — is the client-side half of ORG-03's "unauthorized agents must never
// receive content" contract; the real enforcement is server-side
// (SessionGuard), this is UX, not a security boundary.
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: () => <Outlet />,
});
