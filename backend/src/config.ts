import { resolve } from 'node:path';

// Where uploaded product images are stored; served at /uploads/*
export const UPLOADS_DIR = resolve(process.cwd(), 'uploads');

// SQLite database file, created automatically on first run
export const DATABASE_FILE = resolve(process.cwd(), 'villano.sqlite');
