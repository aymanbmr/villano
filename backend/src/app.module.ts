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
import { DATABASE_FILE, UPLOADS_DIR } from './config.js';

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
    CategoriesModule,
    ProductsModule,
    OrdersModule,
    EmployeesModule,
    AuthModule,
    SeedModule,
  ],
})
export class AppModule {}
