import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUsers, createUser } from '$lib/server/queries/users.js';

export const GET: RequestHandler = async () => {
	const result = await getUsers();
	return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	if (!body.name || typeof body.name !== 'string') {
		return json({ error: 'name is required' }, { status: 400 });
	}
	const user = await createUser({ name: body.name, color: body.color });
	return json(user, { status: 201 });
};
