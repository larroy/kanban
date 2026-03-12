import { db } from '../db.js';
import { projects, tasks } from '../../../../drizzle/schema.js';
import { eq, sql, count } from 'drizzle-orm';

export async function getProjects() {
	const rows = await db
		.select({
			id: projects.id,
			name: projects.name,
			description: projects.description,
			status: projects.status,
			createdAt: projects.createdAt,
			updatedAt: projects.updatedAt,
			totalTasks: count(tasks.id),
			doneTasks: sql<number>`COUNT(CASE WHEN ${tasks.status} = 'done' THEN 1 END)`.mapWith(Number)
		})
		.from(projects)
		.leftJoin(tasks, eq(tasks.projectId, projects.id))
		.groupBy(projects.id)
		.orderBy(projects.createdAt);

	return rows;
}

export async function getProjectById(id: number) {
	const result = await db
		.select({
			id: projects.id,
			name: projects.name,
			description: projects.description,
			status: projects.status,
			createdAt: projects.createdAt,
			updatedAt: projects.updatedAt,
			totalTasks: count(tasks.id),
			doneTasks: sql<number>`COUNT(CASE WHEN ${tasks.status} = 'done' THEN 1 END)`.mapWith(Number)
		})
		.from(projects)
		.leftJoin(tasks, eq(tasks.projectId, projects.id))
		.where(eq(projects.id, id))
		.groupBy(projects.id)
		.limit(1);
	return result[0] ?? null;
}

export async function createProject(data: { name: string; description?: string }) {
	const result = await db
		.insert(projects)
		.values({ name: data.name, description: data.description })
		.returning();
	return result[0];
}

export async function updateProject(
	id: number,
	data: { name?: string; description?: string }
) {
	const result = await db
		.update(projects)
		.set(data)
		.where(eq(projects.id, id))
		.returning();
	return result[0] ?? null;
}

export async function deleteProject(id: number) {
	await db.delete(projects).where(eq(projects.id, id));
}
