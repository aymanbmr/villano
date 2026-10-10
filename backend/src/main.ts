import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All API routes live under /api; /uploads stays at the root
  app.setGlobalPrefix('api', { exclude: ['uploads/{*path}'] });

  // The React dev server runs on another port
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ?? 3000;
  // Behind a reverse proxy (VPS), bind to the loopback so the port is not
  // exposed directly; on the café PC the default reaches the whole network.
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`Villano API running on http://${host}:${port}/api`);
}
await bootstrap();
