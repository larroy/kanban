import type { PageServerLoad } from './$types';
import { getProjects } from '$lib/server/queries/projects.js';

export const load: PageServerLoad = async () => {
	const projects = await getProjects();
	return { projects };
};
