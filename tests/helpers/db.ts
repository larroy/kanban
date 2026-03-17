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

/**
 * Seed for multi-project grouping tests.
 *
 * Creates two projects (Alpha, Beta) with interleaved task positions in the
 * todo column so that flat position order differs from grouped visual order:
 *   Alpha Task 1  pos 0   (project Alpha, updated_at = NOW + 1h — most recent)
 *   Beta Task 1   pos 1   (project Beta,  updated_at = NOW)
 *   Alpha Task 2  pos 2   (project Alpha)
 *   Beta Task 2   pos 3   (project Beta)
 *
 * Visual (grouped): [Alpha] A1 A2 [Beta] B1 B2
 * Flat positions:    A1=0, B1=1, A2=2, B2=3
 */
export type MultiProjectSeedData = {
	alphaProjectId: number;
	betaProjectId: number;
	tasks: {
		alphaTask1Id: number;
		alphaTask2Id: number;
		betaTask1Id: number;
		betaTask2Id: number;
	};
};

export async function seedMultiProjectData(): Promise<MultiProjectSeedData> {
	const client = new pg.Client(DB_URL);
	await client.connect();

	try {
		const projA = await client.query<{ id: number }>(
			`INSERT INTO projects (name, status) VALUES ('Alpha Project', 'active') RETURNING id`
		);
		const projB = await client.query<{ id: number }>(
			`INSERT INTO projects (name, status) VALUES ('Beta Project', 'active') RETURNING id`
		);
		const alphaProjectId = projA.rows[0].id;
		const betaProjectId = projB.rows[0].id;

		// Alpha tasks get a more recent updated_at so Alpha group appears first
		const a1 = await client.query<{ id: number }>(
			`INSERT INTO tasks (title, status, position, project_id, updated_at)
			 VALUES ('Alpha Task 1', 'todo', 0, $1, NOW() + interval '1 hour')
			 RETURNING id`,
			[alphaProjectId]
		);
		const b1 = await client.query<{ id: number }>(
			`INSERT INTO tasks (title, status, position, project_id)
			 VALUES ('Beta Task 1', 'todo', 1, $1)
			 RETURNING id`,
			[betaProjectId]
		);
		const a2 = await client.query<{ id: number }>(
			`INSERT INTO tasks (title, status, position, project_id, updated_at)
			 VALUES ('Alpha Task 2', 'todo', 2, $1, NOW() + interval '1 hour')
			 RETURNING id`,
			[alphaProjectId]
		);
		const b2 = await client.query<{ id: number }>(
			`INSERT INTO tasks (title, status, position, project_id)
			 VALUES ('Beta Task 2', 'todo', 3, $1)
			 RETURNING id`,
			[betaProjectId]
		);

		return {
			alphaProjectId,
			betaProjectId,
			tasks: {
				alphaTask1Id: a1.rows[0].id,
				alphaTask2Id: a2.rows[0].id,
				betaTask1Id: b1.rows[0].id,
				betaTask2Id: b2.rows[0].id,
			},
		};
	} finally {
		await client.end();
	}
}

export async function cleanupMultiProjectData(seed: MultiProjectSeedData): Promise<void> {
	const client = new pg.Client(DB_URL);
	await client.connect();
	try {
		await client.query('DELETE FROM projects WHERE id = ANY($1)', [
			[seed.alphaProjectId, seed.betaProjectId],
		]);
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
