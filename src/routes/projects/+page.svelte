<script lang="ts">
	import type { PageData } from './$types';
	import ProjectCard from '$components/projects/ProjectCard.svelte';
	import CreateProjectModal from '$components/projects/CreateProjectModal.svelte';
	import type { ProjectWithStats } from '$lib/types.js';

	let { data }: { data: PageData } = $props();

	let projects = $state<ProjectWithStats[]>(data.projects);
	let createOpen = $state(false);

	function onCreated(project: ProjectWithStats) {
		projects = [...projects, { ...project, totalTasks: 0, doneTasks: 0 }];
	}
</script>

<svelte:head>
	<title>Projects</title>
</svelte:head>

<div class="p-6">
	<div class="mb-6 flex items-center justify-between">
		<h1 class="text-xl font-bold text-gray-900">Projects</h1>
		<button
			onclick={() => (createOpen = true)}
			class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>
			+ New Project
		</button>
	</div>

	{#if projects.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16 text-center">
			<p class="text-gray-500">No projects yet</p>
			<button
				onclick={() => (createOpen = true)}
				class="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
			>
				Create your first project
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each projects as project (project.id)}
				<ProjectCard {project} />
			{/each}
		</div>
	{/if}
</div>

<CreateProjectModal bind:open={createOpen} oncreated={onCreated} />
