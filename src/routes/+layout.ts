import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch }) => {
	const res = await fetch('/api/users');
	const users = await res.json();
	return { users };
};
