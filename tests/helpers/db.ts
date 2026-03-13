/**
 * Test database helpers.
 *
 * Uses the same Unix-socket peer-auth connection the app uses.
 * Each test suite calls seedTestData() in beforeEach to get a
 * clean, predictable starting state, then cleanupTestData() in
 * afterEach to remove only the rows it created (leaving any
 * pre-existing data untouched).
 *
 * The seed creates:
 *   - 1 project  ("Test Project")
 *   - 3 tasks:
 *       todo    pos 0  – "Todo Task 1"
 *       todo    pos 1  – "Todo Task 2"
 *       doing   pos 0  – "Doing Task 1"
 *
 * All returned ids are used by tests for stable selectors and
 * API assertions.
 */

import pg from 'pg';

const DB_URL = process.env.DATABASE_URL ?? 'postgres:///kanban?host=/var/run/postgresql';

export type SeedData = {
	projectId: number;
	tasks: {
		todo1Id: number;
		todo2Id: number;
		doing1Id: number;
	};
};

export async function seedTestData(): Promise<SeedData> {
	const client = new pg.Client(DB_URL);
	await client.connect();

	try {
		// Create a project
		const projRes = await client.query<{ id: number }>(
			`INSERT INTO projects (name, description, status)
			 VALUES ('Test Project', 'Created by e2e tests', 'active')
			 RETURNING id`
		);
		const projectId = projRes.rows[0].id;

		// Create tasks
		const t1 = await client.query<{ id: number }>(
			`INSERT INTO tasks (title, description, status, position, project_id)
			 VALUES ('Todo Task 1', 'First todo task', 'todo', 0, $1)
			 RETURNING id`,
			[projectId]
		);
		const t2 = await client.query<{ id: number }>(
			`INSERT INTO tasks (title, status, position, project_id)
			 VALUES ('Todo Task 2', 'todo', 1, $1)
			 RETURNING id`,
			[projectId]
		);
		const t3 = await client.query<{ id: number }>(
			`INSERT INTO tasks (title, description, status, position, project_id)
			 VALUES ('Doing Task 1', 'In progress task', 'doing', 0, $1)
			 RETURNING id`,
			[projectId]
		);

		return {
			projectId,
			tasks: {
				todo1Id: t1.rows[0].id,
				todo2Id: t2.rows[0].id,
				doing1Id: t3.rows[0].id,
			},
		};
	} finally {
		await client.end();
	}
}

export async function cleanupTestData(seed: SeedData): Promise<void> {
	const client = new pg.Client(DB_URL);
	await client.connect();
	try {
		// Cascade deletes tasks too
		await client.query('DELETE FROM projects WHERE id = $1', [seed.projectId]);
	} finally {
		await client.end();
	}
}

/** Read a single task row directly from the DB (bypasses the app). */
export async function getTaskFromDb(
	taskId: number
): Promise<{ id: number; status: string; position: number } | null> {
	const client = new pg.Client(DB_URL);
	await client.connect();
	try {
		const res = await client.query<{ id: number; status: string; position: number }>(
			'SELECT id, status, position FROM tasks WHERE id = $1',
			[taskId]
		);
		return res.rows[0] ?? null;
	} finally {
		await client.end();
	}
}

/** Count tasks in a given status for a given project. */
export async function countTasksByStatus(
	projectId: number,
	status: string
): Promise<number> {
	const client = new pg.Client(DB_URL);
	await client.connect();
	try {
		const res = await client.query<{ count: string }>(
			'SELECT COUNT(*) AS count FROM tasks WHERE project_id = $1 AND status = $2',
			[projectId, status]
		);
		return parseInt(res.rows[0].count, 10);
	} finally {
		await client.end();
	}
}
