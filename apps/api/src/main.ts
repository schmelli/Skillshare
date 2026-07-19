import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module";

async function bootstrap() {
  // bodyParser: false — required so better-auth (mounted in Plan 03) owns raw
  // request-body parsing on /api/auth/*, per RESEARCH.md Pattern 1 / Pitfall 2.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bodyParser: false },
  );

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
}

bootstrap();
