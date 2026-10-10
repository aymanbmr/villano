// Loaded here as well as in database.ts: both are read while modules are being
// imported, long before Nest's ConfigModule exists, and either one can be the
// first to be evaluated depending on the import order.
import 'dotenv/config';
import { resolve } from 'node:path';

// Where uploaded product images are stored; served at /uploads/*
export const UPLOADS_DIR = resolve(process.cwd(), 'uploads');

// SQLite database file, created automatically on first run. DB_FILE points it
// somewhere else, which is how a copy can be opened without touching the real
// one — a restored backup, or a test run.
export const DATABASE_FILE = resolve(process.cwd(), process.env.DB_FILE ?? 'villano.sqlite');

// Built frontend (frontend/dist). When present, the API also serves the app
// itself, so one process on one port is enough (production / desktop mode).
export const FRONTEND_DIST = resolve(process.cwd(), '..', 'frontend', 'dist');
