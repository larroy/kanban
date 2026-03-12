<script lang="ts">
	import type { TaskWithAssignee } from '$lib/types.js';
	import UserBadge from '../shared/UserBadge.svelte';

	let {
		task,
		onclick
	}: {
		task: TaskWithAssignee;
		onclick: (task: TaskWithAssignee) => void;
	} = $props();
</script>

<button
	class="w-full cursor-grab rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm hover:border-indigo-300 hover:shadow-md active:cursor-grabbing"
	onclick={() => onclick(task)}
	data-id={task.id}
>
	<p class="text-sm font-medium text-gray-900">{task.title}</p>
	{#if task.description}
		<p class="mt-1 line-clamp-2 text-xs text-gray-500">{task.description}</p>
	{/if}
	{#if task.assignee}
		<div class="mt-2 flex justify-end">
			<UserBadge user={task.assignee} />
		</div>
	{/if}
</button>
