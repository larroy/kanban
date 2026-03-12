<script lang="ts">
	import type { ProjectWithStats } from '$lib/types.js';

	let { project }: { project: ProjectWithStats } = $props();

	const progress = $derived(
		project.totalTasks > 0 ? Math.round((project.doneTasks / project.totalTasks) * 100) : 0
	);
</script>

<a
	href="/projects/{project.id}"
	class="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
>
	<div class="flex items-start justify-between">
		<div class="flex-1 min-w-0">
			<h3 class="font-semibold text-gray-900 truncate">{project.name}</h3>
			{#if project.description}
				<p class="mt-1 text-sm text-gray-500 line-clamp-2">{project.description}</p>
			{/if}
		</div>
		<span class="ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium
			{project.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">
			{project.status}
		</span>
	</div>

	<div class="mt-4">
		<div class="flex items-center justify-between text-xs text-gray-500 mb-1">
			<span>{project.doneTasks} / {project.totalTasks} tasks done</span>
			<span>{progress}%</span>
		</div>
		<div class="h-1.5 rounded-full bg-gray-100">
			<div
				class="h-1.5 rounded-full bg-indigo-500 transition-all"
				style="width: {progress}%"
			></div>
		</div>
	</div>
</a>
