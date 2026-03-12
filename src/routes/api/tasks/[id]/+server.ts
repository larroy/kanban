import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTaskById, updateTask, deleteTask } from '$lib/server/queries/tasks.js';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'invalid id' }, { status: 400 });
	const task = await getTaskById(id);
	if (!task) return json({ error: 'not found' }, { status: 404 });
	return json(task);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'invalid id' }, { status: 400 });
	const body = await request.json();
	const task = await updateTask(id, {
		title: body.title,
		description: body.description,
		assigneeId: body.assigneeId !== undefined ? body.assigneeId : undefined
	});
	if (!task) return json({ error: 'not found' }, { status: 404 });
	return json(task);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'invalid id' }, { status: 400 });
	await deleteTask(id);
	return new Response(null, { status: 204 });
};
