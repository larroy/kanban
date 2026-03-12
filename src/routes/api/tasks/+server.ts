import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTasks, createTask } from '$lib/server/queries/tasks.js';

export const GET: RequestHandler = async ({ url }) => {
	const projectId = url.searchParams.get('projectId');
	const status = url.searchParams.get('status');
	const result = await getTasks({
		projectId: projectId ? parseInt(projectId) : undefined,
		status: status ?? undefined
	});
	return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	if (!body.title || typeof body.title !== 'string') {
		return json({ error: 'title is required' }, { status: 400 });
	}
	if (!body.projectId) {
		return json({ error: 'projectId is required' }, { status: 400 });
	}
	const task = await createTask({
		title: body.title,
		projectId: parseInt(body.projectId),
		description: body.description,
		status: body.status,
		assigneeId: body.assigneeId ?? null
	});
	return json(task, { status: 201 });
};
