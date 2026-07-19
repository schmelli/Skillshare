import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { auth } from "./auth";

export type AuthenticatedUser = Awaited<
  ReturnType<typeof auth.api.getSession>
>;

// The single server-side session-validation point every protected route
// reuses (RESEARCH.md System Architecture Diagram): validates the session
// via `auth.api.getSession`, rejects (never serves) an unauthenticated
// request, and attaches `req.user`/`req.session` for downstream handlers.
@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();

    const session = await auth.api.getSession({
      headers: toWebHeaders(req.headers),
    });

    if (!session) {
      return false;
    }

    (req as FastifyRequest & { user: unknown; session: unknown }).user =
      session.user;
    (req as FastifyRequest & { user: unknown; session: unknown }).session =
      session.session;
    return true;
  }
}

function toWebHeaders(rawHeaders: FastifyRequest["headers"]): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}
