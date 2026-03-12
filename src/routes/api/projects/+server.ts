import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProjects, createProject } from '$lib/server/queries/projects.js';

export const GET: RequestHandler = async () => {
	const result = await getProjects();
	return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	if (!body.name || typeof body.name !== 'string') {
		return json({ error: 'name is required' }, { status: 400 });
	}
	const project = await createProject({ name: body.name, description: body.description });
	return json(project, { status: 201 });
};
