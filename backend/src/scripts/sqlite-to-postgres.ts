// Transfère une base SQLite existante vers PostgreSQL.
//
//   cd backend && npm run migrate:postgres -- villano.sqlite
//
// La base PostgreSQL doit déjà avoir ses tables : démarrer le serveur une
// fois avec DB_SYNC=true les crée. La source est ouverte en lecture seule et
// n'est jamais modifiée, donc la manœuvre peut être retentée sans risque.
//
// Les colonnes portent les mêmes noms dans les deux moteurs ; ce qui change
// est le typage, que SQLite traite avec insouciance : un booléen y est un 0 ou
// un 1, une date une chaîne de caractères. Chaque valeur est donc convertie
// d'après le type réel de la colonne PostgreSQL, lu dans le catalogue.
import Database from 'better-sqlite3';
import pg from 'pg';
import 'dotenv/config';

// L'ordre compte : une commande référence un serveur, une ligne une commande.
const TABLES = [
  'categories',
  'products',
  'employees',
  'work_days',
  'settings',
  'orders',
  'order_items',
];

const source = process.argv[2] ?? 'villano.sqlite';
const force = process.argv.includes('--force');

const url = process.env.DATABASE_URL;
const target = url
  ? { connectionString: url }
  : {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? 'villano',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'villano',
    };

const sqlite = new Database(source, { readonly: true });
const client = new pg.Client(target);
await client.connect();

const columnTypes = async (table: string) => {
  const { rows } = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
    [table],
  );
  return new Map<string, string>(rows.map((r: { column_name: string; data_type: string }) => [r.column_name, r.data_type]));
};

const coerce = (value: unknown, type: string | undefined) => {
  if (value === null || value === undefined) return null;
  if (type === 'boolean') return value === 1 || value === true || value === '1';
  if (type?.startsWith('timestamp') || type === 'date') {
    return value instanceof Date ? value : new Date(value as string | number);
  }
  return value;
};

let grandTotal = 0;
try {
  await client.query('BEGIN');

  for (const table of TABLES) {
    const exists = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(table);
    if (!exists) {
      console.log(`${table.padEnd(12)} absente de la source, ignoree`);
      continue;
    }

    const types = await columnTypes(table);
    if (types.size === 0) {
      throw new Error(
        `La table "${table}" n'existe pas dans PostgreSQL. Demarrez le serveur une fois avec DB_SYNC=true pour creer le schema.`,
      );
    }

    const { rows: countRows } = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
    if (countRows[0].n > 0) {
      if (!force) {
        throw new Error(
          `La table "${table}" contient deja ${countRows[0].n} ligne(s). Relancez avec --force pour les remplacer.`,
        );
      }
      await client.query(`TRUNCATE "${table}" CASCADE`);
    }

    const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
    if (rows.length === 0) {
      console.log(`${table.padEnd(12)} vide`);
      continue;
    }

    // Seules les colonnes presentes des deux cotes sont reprises
    const columns = Object.keys(rows[0]).filter((c) => types.has(c));
    const quoted = columns.map((c) => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const statement = `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders})`;

    for (const row of rows) {
      await client.query(
        statement,
        columns.map((c) => coerce(row[c], types.get(c))),
      );
    }

    // Sans cela, la prochaine insertion reutiliserait l'identifiant 1
    if (types.has('id')) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
        [table],
      );
    }

    grandTotal += rows.length;
    console.log(`${table.padEnd(12)} ${String(rows.length).padStart(6)} ligne(s)`);
  }

  await client.query('COMMIT');
  console.log(`\nTransfere : ${grandTotal} ligne(s). La base SQLite n'a pas ete modifiee.`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error('\nEchec, rien n a ete ecrit :', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
  sqlite.close();
}
