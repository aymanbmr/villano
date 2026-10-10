// Which database engine the server talks to, and the few column types that
// differ between the two.
//
// SQLite stays the default: the café's caisse runs the whole thing from a
// folder, with no service to install and a database that is one file to copy.
// PostgreSQL is there for a hosted server, and is chosen simply by setting
// DATABASE_URL (or DB_TYPE=postgres).
//
// The .env file is read here rather than by Nest's ConfigModule, because the
// entity files below need the answer while they are being loaded — long
// before any Nest module is constructed.
import 'dotenv/config';
import type { ColumnType } from 'typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DATABASE_FILE } from './config.js';

export const isPostgres =
  (process.env.DB_TYPE ?? (process.env.DATABASE_URL ? 'postgres' : 'sqlite')) === 'postgres';

/**
 * Money. SQLite's `real` is an 8-byte float, and `double precision` is its
 * exact PostgreSQL equivalent — the two engines therefore compute totals
 * identically, which is the point: a migration must not quietly change a
 * single receipt. `numeric` would be stricter still, but the PostgreSQL
 * driver hands numerics back as strings, and `total + total` would silently
 * concatenate instead of adding.
 */
export const MONEY: ColumnType = isPostgres ? 'double precision' : 'real';

/** A point in time. PostgreSQL has no `datetime`. */
export const TIMESTAMP: ColumnType = isPostgres ? 'timestamp' : 'datetime';

/**
 * Rebuilding the schema from the entities at every start is convenient while
 * the schema moves, and dangerous once the database holds real sales: a
 * renamed column is dropped and recreated empty. Off by default as soon as a
 * hosted database is used; DB_SYNC=true forces it back on.
 */
const synchronize = process.env.DB_SYNC ? process.env.DB_SYNC === 'true' : !isPostgres;

export const typeOrmOptions: TypeOrmModuleOptions = isPostgres
  ? {
      type: 'postgres',
      ...(process.env.DATABASE_URL
        ? { url: process.env.DATABASE_URL }
        : {
            host: process.env.DB_HOST ?? '127.0.0.1',
            port: Number(process.env.DB_PORT ?? 5432),
            username: process.env.DB_USER ?? 'villano',
            password: process.env.DB_PASSWORD ?? '',
            database: process.env.DB_NAME ?? 'villano',
          }),
      ...(process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
      autoLoadEntities: true,
      synchronize,
    }
  : {
      type: 'better-sqlite3',
      database: DATABASE_FILE,
      autoLoadEntities: true,
      synchronize,
    };

export const describeDatabase = () =>
  isPostgres
    ? `PostgreSQL ${process.env.DATABASE_URL ? '(DATABASE_URL)' : `${process.env.DB_HOST ?? '127.0.0.1'}:${process.env.DB_PORT ?? 5432}`}`
    : `SQLite ${DATABASE_FILE}`;
