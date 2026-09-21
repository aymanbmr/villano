import { resolve } from 'node:path';

// Where uploaded product images are stored; served at /uploads/*
export const UPLOADS_DIR = resolve(process.cwd(), 'uploads');

// SQLite database file, created automatically on first run
export const DATABASE_FILE = resolve(process.cwd(), 'villano.sqlite');

// Built frontend (frontend/dist). When present, the API also serves the app
// itself, so one process on one port is enough (production / desktop mode).
export const FRONTEND_DIST = resolve(process.cwd(), '..', 'frontend', 'dist');
