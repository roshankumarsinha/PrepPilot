import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadDotenv({ path: resolve(__dirname, '../../.env'), quiet: true });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set (copy .env.example to .env)');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
});
