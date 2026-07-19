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
