import { Client } from 'pg';

export const DB_SCHEMAS = ['identity', 'admin', 'taxi', 'insurance', 'loans', 'organic', 'reporting', 'solutions'];

// TypeORM synchronize does not create schemas, and hosted Postgres (Supabase/Neon) starts empty.
export async function ensureSchemas(url: string, ssl: boolean) {
  const client = new Client({ connectionString: url, ssl: ssl ? { rejectUnauthorized: true } : false });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    for (const name of DB_SCHEMAS) await client.query(`CREATE SCHEMA IF NOT EXISTS "${name}"`);
  } finally {
    await client.end();
  }
}
