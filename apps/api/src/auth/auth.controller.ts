import { All, Controller, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "./auth";

// Framework-agnostic better-auth mount (RESEARCH.md Pattern 1): a catch-all
// route converts the raw Fastify request into a standard `Request`, hands it
// to `auth.handler`, and writes the standard `Response` back to the Fastify
// reply. Deliberately NOT using `@thallesp/nestjs-better-auth` — flagged
// [SUS] in RESEARCH.md's Package Legitimacy Audit (young, single-maintainer,
// documented Fastify/CORS gaps).
//
// `bodyParser: false` is set globally in main.ts (Plan 01) specifically so
// this route can read the raw request stream itself instead of racing
// Nest's default body parser for it.
@Controller()
export class AuthController {
  @All("/api/auth/*")
  async handleAuth(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const request = await toWebRequest(req);
    const response = await auth.handler(request);
    await sendWebResponse(reply, response);
  }
}

async function toWebRequest(req: FastifyRequest): Promise<Request> {
  const url = `${req.protocol}://${req.hostname}${req.url}`;
  const headers = toWebHeaders(req.headers);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";

  // `req.body` is already the raw Buffer here — AuthModule's
  // RawBodyParserInitializer overrides Fastify's default JSON parser with a
  // raw-buffer passthrough specifically so better-auth (not Fastify) is the
  // one to parse the body.
  const body =
    hasBody && Buffer.isBuffer(req.body) && req.body.length > 0
      ? req.body
      : undefined;

  return new Request(url, {
    method: req.method,
    headers,
    body,
  });
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

async function sendWebResponse(
  reply: FastifyReply,
  response: Response,
): Promise<void> {
  reply.status(response.status);

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return; // handled below (may be multi-valued)
    reply.header(key, value);
  });
  if (setCookies.length > 0) {
    reply.header("set-cookie", setCookies);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  reply.send(buffer);
}
