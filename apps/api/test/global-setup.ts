import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

/**
 * E2E tests run against a dedicated `<db>_test` database on the same server, never the dev
 * database: a test sync removes repos that are not in its own config, which would wipe the
 * real index. The database is created if needed and migrated before the tests start.
 */
export default async function globalSetup(): Promise<void> {
  loadDotenv({ path: resolve(__dirname, '../../../.env'), quiet: true });
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL must be set for e2e tests');

  const url = new URL(baseUrl);
  const testDb = url.pathname.slice(1).endsWith('_test')
    ? url.pathname.slice(1)
    : `${url.pathname.slice(1)}_test`;
  url.pathname = `/${testDb}`;

  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [testDb]);
  if (rowCount === 0) await admin.query(`create database "${testDb}"`);
  await admin.end();

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await migrate(drizzle({ client }), { migrationsFolder: resolve(__dirname, '../drizzle') });
  await client.end();

  process.env.DATABASE_URL = url.toString();
  process.env.SYNC_SCHEDULE_ENABLED = 'false';
}
