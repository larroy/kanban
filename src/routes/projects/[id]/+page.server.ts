import type { PageServerLoad } from './$types';
import { getProjectById } from '$lib/server/queries/projects.js';
import { getTasks } from '$lib/server/queries/tasks.js';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id);
	if (isNaN(id)) error(400, 'Invalid project id');

	const [project, tasks] = await Promise.all([getProjectById(id), getTasks({ projectId: id })]);

	if (!project) error(404, 'Project not found');

	return { project, tasks };
};
