<script lang="ts">
	import type { PageData } from './$types';
	import KanbanBoard from '$components/board/KanbanBoard.svelte';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Kanban Board</title>
</svelte:head>

<div class="p-4">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-xl font-bold text-gray-900">Board</h1>
	</div>
	<KanbanBoard initialTasks={data.tasks} users={data.users} projects={data.projects} projectsWithStats={data.projects} />
</div>
