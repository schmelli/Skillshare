import { createAuthClient } from "better-auth/react";

// Points at the API origin. Leaving `baseURL` unset in dev lets better-auth
// fall back to `window.location.origin + "/api/auth"` (http://localhost:5173
// -> proxied by Vite's dev server to localhost:3000, same as apps/web/src/lib/api.ts's
// `apiFetch` helper); VITE_API_BASE_URL overrides this for a non-proxied
// deployment where the dashboard is served from a different origin than the API.
const baseURL = import.meta.env.VITE_API_BASE_URL || undefined;

export const authClient = createAuthClient({ baseURL });

export const { signIn, signUp, signOut, useSession } = authClient;
