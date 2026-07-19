import type { WorkspaceRole } from "@skillshare/shared";

// Typed fetch helper for the dashboard -> NestJS API calls. Uses
// `credentials: "include"` so better-auth's session cookie (Plan 03) travels
// with every request; the Vite dev proxy (`/api` -> localhost:3000) means no
// separate API base URL is needed in dev, and in prod the built SPA is served
// same-origin by the Fastify API (later phase).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `API request to ${path} failed with status ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

export interface HealthResponse {
  status: "ok";
  tenantCount: number;
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health");
}

export interface WorkspaceListItem {
  id: string;
  name: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceListItem[];
  /** Whether the caller is currently allowed to create another workspace
   * (bootstrap-empty-tenant OR already Admin of some workspace) — drives
   * which empty-state copy/CTA the dashboard renders (UI-SPEC). */
  canCreate: boolean;
}

export function getWorkspaces(): Promise<WorkspacesResponse> {
  return apiFetch<WorkspacesResponse>("/api/workspaces");
}

/**
 * `apiFetch`'s generic `ApiError` doesn't carry the response body, but the
 * create-workspace name-conflict copy (UI-SPEC) needs the server's exact
 * message. This variant reads and attaches the parsed error body so callers
 * can distinguish "name already exists" from any other failure.
 */
export class WorkspaceApiError extends ApiError {
  constructor(
    status: number,
    message: string,
    public readonly body: { message?: string | string[] } | undefined,
  ) {
    super(status, message);
    this.name = "WorkspaceApiError";
  }
}

export async function createWorkspace(
  name: string,
): Promise<WorkspaceListItem> {
  const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new WorkspaceApiError(
      response.status,
      `API request to /api/workspaces failed with status ${response.status}`,
      body,
    );
  }

  return (await response.json()) as WorkspaceListItem;
}
