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
  await app.listen(port);
  console.log('Villano API running on http://localhost:' + port + '/api');
}
await bootstrap();
