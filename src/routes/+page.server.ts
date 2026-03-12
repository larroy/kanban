import type { PageServerLoad } from './$types';
import { getTasks } from '$lib/server/queries/tasks.js';
import { getProjects } from '$lib/server/queries/projects.js';

export const load: PageServerLoad = async () => {
	const [tasks, projects] = await Promise.all([getTasks(), getProjects()]);
	return { tasks, projects };
};
