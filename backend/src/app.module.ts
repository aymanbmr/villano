import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { SeedModule } from './seed/seed.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { AuthModule } from './auth/auth.module.js';
import { StatsModule } from './stats/stats.module.js';
import { WorkDaysModule } from './work-days/work-days.module.js';
import { existsSync } from 'node:fs';
import { DATABASE_FILE, FRONTEND_DIST, UPLOADS_DIR } from './config.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: DATABASE_FILE,
      autoLoadEntities: true,
      // Auto-creates/updates tables from the entities. Fine while the schema
      // is evolving; switch to migrations before going live.
      synchronize: true,
    }),
    // Product images: http://localhost:3000/uploads/<file>
    ServeStaticModule.forRoot({
      rootPath: UPLOADS_DIR,
      serveRoot: '/uploads',
    }),
    // The built React app at / (only if it has been built)
    ...(existsSync(FRONTEND_DIST)
      ? [
          ServeStaticModule.forRoot({
            rootPath: FRONTEND_DIST,
            serveRoot: '/',
            exclude: ['/api/{*path}', '/uploads/{*path}'],
          }),
        ]
      : []),
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    EmployeesModule,
    AuthModule,
    StatsModule,
    WorkDaysModule,
    SeedModule,
  ],
})
export class AppModule {}
