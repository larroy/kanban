import { db, pool } from '../db.js';
import { tasks, users } from '../../../../drizzle/schema.js';
import { eq, and, sql } from 'drizzle-orm';

export type TaskWithAssignee = typeof tasks.$inferSelect & {
	assignee: { id: number; name: string; color: string } | null;
};

async function selectTasksWithAssignee(where?: Parameters<typeof db.select>[0]) {
	return db
		.select({
			id: tasks.id,
			title: tasks.title,
			description: tasks.description,
			status: tasks.status,
			position: tasks.position,
			projectId: tasks.projectId,
			assigneeId: tasks.assigneeId,
			createdAt: tasks.createdAt,
			updatedAt: tasks.updatedAt,
			assignee: {
				id: users.id,
				name: users.name,
				color: users.color
			}
		})
		.from(tasks)
		.leftJoin(users, eq(tasks.assigneeId, users.id));
}

export async function getTasks(filters?: { projectId?: number; status?: string }) {
	let query = db
		.select({
			id: tasks.id,
			title: tasks.title,
			description: tasks.description,
			status: tasks.status,
			position: tasks.position,
			projectId: tasks.projectId,
			assigneeId: tasks.assigneeId,
			createdAt: tasks.createdAt,
			updatedAt: tasks.updatedAt,
			assignee: {
				id: users.id,
				name: users.name,
				color: users.color
			}
		})
		.from(tasks)
		.leftJoin(users, eq(tasks.assigneeId, users.id))
		.$dynamic();

	if (filters?.projectId && filters?.status) {
		query = query.where(
			and(eq(tasks.projectId, filters.projectId), eq(tasks.status, filters.status))
		);
	} else if (filters?.projectId) {
		query = query.where(eq(tasks.projectId, filters.projectId));
	} else if (filters?.status) {
		query = query.where(eq(tasks.status, filters.status));
	}

	return query.orderBy(tasks.status, tasks.position);
}

export async function getTaskById(id: number) {
	const result = await db
		.select({
			id: tasks.id,
			title: tasks.title,
			description: tasks.description,
			status: tasks.status,
			position: tasks.position,
			projectId: tasks.projectId,
			assigneeId: tasks.assigneeId,
			createdAt: tasks.createdAt,
			updatedAt: tasks.updatedAt,
			assignee: {
				id: users.id,
				name: users.name,
				color: users.color
			}
		})
		.from(tasks)
		.leftJoin(users, eq(tasks.assigneeId, users.id))
		.where(eq(tasks.id, id))
		.limit(1);
	return result[0] ?? null;
}

export async function createTask(data: {
	title: string;
	projectId: number;
	description?: string;
	status?: string;
	assigneeId?: number | null;
}) {
	// Get max position in target status column
	const maxPosResult = await db
		.select({ maxPos: sql<number>`COALESCE(MAX(${tasks.position}), -1)`.mapWith(Number) })
		.from(tasks)
		.where(
			and(
				eq(tasks.projectId, data.projectId),
				eq(tasks.status, data.status ?? 'todo')
			)
		);
	const position = (maxPosResult[0]?.maxPos ?? -1) + 1;

	const result = await db
		.insert(tasks)
		.values({
			title: data.title,
			projectId: data.projectId,
			description: data.description,
			status: data.status ?? 'todo',
			position,
			assigneeId: data.assigneeId ?? null
		})
		.returning();
	return result[0];
}

export async function updateTask(
	id: number,
	data: { title?: string; description?: string; assigneeId?: number | null }
) {
	const result = await db
		.update(tasks)
		.set(data)
		.where(eq(tasks.id, id))
		.returning();
	return result[0] ?? null;
}

export async function deleteTask(id: number) {
	const deleted = await db.delete(tasks).where(eq(tasks.id, id)).returning();
	return deleted[0] ?? null;
}

export async function moveTask(
	id: number,
	newStatus: string,
	newPosition: number
) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		// Get current task state
		const { rows: taskRows } = await client.query<{
			status: string;
			position: number;
			project_id: number;
		}>('SELECT status, position, project_id FROM tasks WHERE id = $1 FOR UPDATE', [id]);

		if (taskRows.length === 0) {
			await client.query('ROLLBACK');
			return null;
		}

		const task = taskRows[0];
		const oldStatus = task.status;
		const oldPosition = task.position;

		if (oldStatus === newStatus) {
			// Same column reorder
			if (oldPosition < newPosition) {
				// Moving down: shift items between old and new pos up
				await client.query(
					`UPDATE tasks SET position = position - 1
           WHERE status = $1 AND position > $2 AND position <= $3 AND id != $4`,
					[newStatus, oldPosition, newPosition, id]
				);
			} else if (oldPosition > newPosition) {
				// Moving up: shift items between new and old pos down
				await client.query(
					`UPDATE tasks SET position = position + 1
           WHERE status = $1 AND position >= $2 AND position < $3 AND id != $4`,
					[newStatus, newPosition, oldPosition, id]
				);
			}
		} else {
			// Different column: close gap in source, open slot in dest
			await client.query(
				`UPDATE tasks SET position = position - 1
         WHERE status = $1 AND position > $2`,
				[oldStatus, oldPosition]
			);
			await client.query(
				`UPDATE tasks SET position = position + 1
         WHERE status = $1 AND position >= $2`,
				[newStatus, newPosition]
			);
		}

		// Move the task itself
		const { rows: updated } = await client.query(
			`UPDATE tasks SET status = $1, position = $2 WHERE id = $3 RETURNING *`,
			[newStatus, newPosition, id]
		);

		await client.query('COMMIT');
		return updated[0];
	} catch (err) {
		await client.query('ROLLBACK');
		throw err;
	} finally {
		client.release();
	}
}
