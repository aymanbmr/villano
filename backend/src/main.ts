import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { describeDatabase } from './database.js';

interface ReadOnlyResponse {
  status(code: number): { json(body: unknown): void };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // All API routes live under /api; /uploads stays at the root
  app.setGlobalPrefix('api', { exclude: ['uploads/{*path}'] });

  // Copie de consultation : un second serveur qui reçoit régulièrement la base
  // du café doit refuser toute écriture. Sans cela, une commande prise ici
  // serait effacée à la synchronisation suivante — et personne ne le verrait,
  // puisque la caisse aurait affiché qu'elle était enregistrée.
  if (process.env.READ_ONLY === 'true') {
    app.use((req: { method: string; path: string }, res: ReadOnlyResponse, next: () => void) => {
      const lecture = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
      // Se connecter reste permis : c'est un POST, mais rien n'est modifié
      if (lecture || req.path === '/api/auth/login') return next();
      res.status(403).json({
        statusCode: 403,
        message:
          'Ce serveur est une copie de consultation : les commandes se prennent sur la caisse du café.',
      });
    });
    console.log('Mode consultation : toute écriture est refusée.');
  }

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
  console.log(`Base de donnees : ${describeDatabase()}`);
}
await bootstrap();
