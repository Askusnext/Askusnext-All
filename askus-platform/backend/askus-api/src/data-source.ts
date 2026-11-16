import 'reflect-metadata';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from './common/snake-naming.strategy';

// Used by the TypeORM CLI (migration:generate / migration:run) against the compiled output in dist/.
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  namingStrategy: new SnakeNamingStrategy(),
  uuidExtension: 'pgcrypto',
  entities: [join(__dirname, '**/*.entit*.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
});
