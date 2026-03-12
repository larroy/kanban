import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { moveTask } from '$lib/server/queries/tasks.js';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'invalid id' }, { status: 400 });

	const body = await request.json();
	if (!body.status || typeof body.position !== 'number') {
		return json({ error: 'status and position are required' }, { status: 400 });
	}

	const validStatuses = ['todo', 'doing', 'done'];
	if (!validStatuses.includes(body.status)) {
		return json({ error: 'invalid status' }, { status: 400 });
	}

	const task = await moveTask(id, body.status, body.position);
	if (!task) return json({ error: 'not found' }, { status: 404 });
	return json(task);
};
