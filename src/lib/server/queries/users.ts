import { db } from '../db.js';
import { users } from '../../../../drizzle/schema.js';
import { eq } from 'drizzle-orm';

export async function getUsers() {
	return db.select().from(users).orderBy(users.name);
}

export async function getUserById(id: number) {
	const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
	return result[0] ?? null;
}

export async function createUser(data: { name: string; color?: string }) {
	const result = await db
		.insert(users)
		.values({ name: data.name, color: data.color ?? '#6366f1' })
		.returning();
	return result[0];
}
