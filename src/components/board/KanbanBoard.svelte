<script lang="ts">
	import type { TaskWithAssignee, User, Project } from '$lib/types.js';
	import { board } from '$lib/board.svelte.js';
	import KanbanColumn from './KanbanColumn.svelte';

	let {
		initialTasks,
		users,
		projects
	}: {
		initialTasks: TaskWithAssignee[];
		users: User[];
		projects: Project[];
	} = $props();

	$effect(() => {
		board.setTasks(initialTasks);
	});
</script>

<div class="flex gap-4 overflow-x-auto p-4">
	<KanbanColumn
		status="todo"
		label="Todo"
		color="bg-gray-400"
		tasks={board.todo}
		{users}
		{projects}
	/>
	<KanbanColumn
		status="doing"
		label="Doing"
		color="bg-blue-500"
		tasks={board.doing}
		{users}
		{projects}
	/>
	<KanbanColumn
		status="done"
		label="Done"
		color="bg-green-500"
		tasks={board.done}
		{users}
		{projects}
	/>
</div>
