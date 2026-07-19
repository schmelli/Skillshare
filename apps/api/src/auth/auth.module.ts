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
// swaps it for a raw-buffer passthrough, giving AuthController the raw body
// it needs (RESEARCH.md Pitfall 2). Safe app-wide for this phase since no
// other route yet consumes a JSON body via `@Body()`; a future phase adding
// one should scope this to an encapsulated `/api/auth` Fastify plugin
// instead of overriding it globally.
@Injectable()
class RawBodyParserInitializer implements OnModuleInit {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  onModuleInit() {
    const fastify =
      this.adapterHost.httpAdapter.getInstance<FastifyInstance>();
    fastify.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => done(null, body),
    );
  }
}

@Module({
  controllers: [AuthController],
  providers: [SessionGuard, RawBodyParserInitializer],
  exports: [SessionGuard],
})
export class AuthModule {}
