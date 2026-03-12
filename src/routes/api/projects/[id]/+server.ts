import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getProjectById,
	updateProject,
	deleteProject
} from '$lib/server/queries/projects.js';
import { getTasks } from '$lib/server/queries/tasks.js';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'invalid id' }, { status: 400 });
	const project = await getProjectById(id);
	if (!project) return json({ error: 'not found' }, { status: 404 });
	const projectTasks = await getTasks({ projectId: id });
	return json({ ...project, tasks: projectTasks });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'invalid id' }, { status: 400 });
	const body = await request.json();
	const project = await updateProject(id, {
		name: body.name,
		description: body.description
	});
	if (!project) return json({ error: 'not found' }, { status: 404 });
	return json(project);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) return json({ error: 'invalid id' }, { status: 400 });
	await deleteProject(id);
	return new Response(null, { status: 204 });
};
