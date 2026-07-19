import { Injectable, Module, OnModuleInit } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller";
import { SessionGuard } from "./session.guard";

// Fastify's OWN built-in default 'application/json' content-type parser
// still runs even with Nest's `bodyParser: false` (that flag only skips
// *Nest's* parser registration) — it would otherwise consume+JSON-parse the
// request stream before AuthController ever sees it, leaving nothing for
// `auth.handler` to read. Fastify explicitly supports overriding its
// built-in JSON/text parsers (not a "custom parser conflict"), so this
// swaps it for a raw-buffer passthrough on `/api/auth/*` only, giving
// AuthController the raw body it needs (RESEARCH.md Pitfall 2). Every other
// route (e.g. WorkspacesController's `@Body()`, Plan 04) gets normal JSON
// parsing — this used to be an unconditional passthrough scoped app-wide
// "since no other route yet consumes a JSON body via @Body()"; Plan 04's
// WorkspacesController is that route, so the parser now branches on the
// request path instead of moving to a separate encapsulated Fastify plugin.
@Injectable()
class RawBodyParserInitializer implements OnModuleInit {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  onModuleInit() {
    const fastify =
      this.adapterHost.httpAdapter.getInstance<FastifyInstance>();
    fastify.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (req, body: Buffer, done) => {
        if (req.url?.startsWith("/api/auth/")) {
          done(null, body);
          return;
        }
        if (body.length === 0) {
          done(null, undefined);
          return;
        }
        try {
          done(null, JSON.parse(body.toString("utf-8")));
        } catch (error) {
          done(error as Error, undefined);
        }
      },
    );
  }
}

@Module({
  controllers: [AuthController],
  providers: [SessionGuard, RawBodyParserInitializer],
  exports: [SessionGuard],
})
export class AuthModule {}
