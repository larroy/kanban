import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../../drizzle/schema.js';

const pool = new Pool({
	connectionString:
		process.env.DATABASE_URL ?? 'postgres:///kanban?host=/var/run/postgresql'
});

export const db = drizzle(pool, { schema });
export { pool };
