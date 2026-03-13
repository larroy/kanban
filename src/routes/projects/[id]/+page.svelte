<script lang="ts">
	import type { PageData } from './$types';
	import type { TaskWithAssignee } from '$lib/types.js';
	import UserBadge from '$components/shared/UserBadge.svelte';
	import Modal from '$components/shared/Modal.svelte';

	let { data }: { data: PageData } = $props();

	let project = $state(data.project);
	let tasks = $state<TaskWithAssignee[]>(data.tasks);
	let addOpen = $state(false);
	let newTitle = $state('');
	let newDesc = $state('');
	let newStatus = $state('todo');
	let newAssigneeId = $state<number | null>(null);
	let adding = $state(false);

	const todoTasks = $derived(tasks.filter(t => t.status === 'todo').sort((a, b) => a.position - b.position));
	const doingTasks = $derived(tasks.filter(t => t.status === 'doing').sort((a, b) => a.position - b.position));
	const doneTasks = $derived(tasks.filter(t => t.status === 'done').sort((a, b) => a.position - b.position));

	async function addTask() {
		if (!newTitle.trim()) return;
		adding = true;
		try {
			const res = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: newTitle.trim(),
					description: newDesc || null,
					projectId: project.id,
					status: newStatus,
					assigneeId: newAssigneeId
				})
			});
			if (res.ok) {
				const task = await res.json();
				const assignee = data.users.find((u: { id: number }) => u.id === newAssigneeId) ?? null;
				tasks = [...tasks, {
					...task,
					assignee: assignee ? { id: assignee.id, name: assignee.name, color: assignee.color } : null
				}];
				newTitle = '';
				newDesc = '';
				newStatus = 'todo';
				newAssigneeId = null;
				addOpen = false;
				// Update project stats
				project = { ...project, totalTasks: tasks.length };
			}
		} finally {
			adding = false;
		}
	}

	async function deleteTask(id: number) {
		if (!confirm('Delete this task?')) return;
		await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
		tasks = tasks.filter(t => t.id !== id);
	}
</script>

<svelte:head>
	<title>{project.name}</title>
</svelte:head>

<div class="p-6">
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<a href="/projects" class="text-sm text-gray-500 hover:text-gray-700">← Projects</a>
		</div>
		<div class="mt-2 flex items-start justify-between">
			<div>
				<div class="flex items-center gap-3">
					<h1 class="text-2xl font-bold text-gray-900">{project.name}</h1>
					<span class="rounded-full px-2 py-0.5 text-xs font-medium
						{project.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">
						{project.status}
					</span>
				</div>
				{#if project.description}
					<p class="mt-1 text-sm text-gray-600">{project.description}</p>
				{/if}
			</div>
			<button
				onclick={() => (addOpen = true)}
				class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
			>
				+ Add Task
			</button>
		</div>
		<div class="mt-3 flex items-center gap-4 text-sm text-gray-500">
			<span>{tasks.length} total tasks</span>
			<span>{doneTasks.length} done</span>
			{#if tasks.length > 0}
				<div class="flex items-center gap-2">
					<div class="h-1.5 w-32 rounded-full bg-gray-200">
						<div
							class="h-1.5 rounded-full bg-indigo-500"
							style="width: {Math.round((doneTasks.length / tasks.length) * 100)}%"
						></div>
					</div>
					<span>{Math.round((doneTasks.length / tasks.length) * 100)}%</span>
				</div>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		{#each [{ label: 'Todo', tasks: todoTasks, color: 'bg-gray-400' }, { label: 'Doing', tasks: doingTasks, color: 'bg-blue-500' }, { label: 'Done', tasks: doneTasks, color: 'bg-green-500' }] as col}
			<div class="rounded-xl bg-gray-50 p-4">
				<div class="mb-3 flex items-center gap-2">
					<span class="h-2.5 w-2.5 rounded-full {col.color}"></span>
					<h2 class="font-semibold text-gray-800">{col.label}</h2>
					<span class="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
						{col.tasks.length}
					</span>
				</div>
				<div class="space-y-2">
					{#each col.tasks as task (task.id)}
						<div class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
							<div class="flex items-start justify-between gap-2">
								<p class="text-sm font-medium text-gray-900">{task.title}</p>
								<button
									onclick={() => deleteTask(task.id)}
									class="shrink-0 rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-400"
									title="Delete"
								>
									<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>
							{#if task.description}
								<p class="mt-1 text-xs text-gray-500">{task.description}</p>
							{/if}
							{#if task.assignee}
								<div class="mt-2 flex justify-end">
									<UserBadge user={task.assignee} />
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>

<Modal bind:open={addOpen} title="Add Task">
	<div class="space-y-3">
		<div>
			<label class="block text-sm font-medium text-gray-700">Title *</label>
			<input
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				placeholder="Task title"
				bind:value={newTitle}
			/>
		</div>
		<div>
			<label class="block text-sm font-medium text-gray-700">Description</label>
			<textarea
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				rows="2"
				bind:value={newDesc}
			></textarea>
		</div>
		<div>
			<label class="block text-sm font-medium text-gray-700">Status</label>
			<select
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				bind:value={newStatus}
			>
				<option value="todo">Todo</option>
				<option value="doing">Doing</option>
				<option value="done">Done</option>
			</select>
		</div>
		<div>
			<label class="block text-sm font-medium text-gray-700">Assignee</label>
			<select
				class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				bind:value={newAssigneeId}
			>
				<option value={null}>Unassigned</option>
				{#each data.users as u}
					<option value={u.id}>{u.name}</option>
				{/each}
			</select>
		</div>
		<div class="pt-1">
			<button
				onclick={addTask}
				disabled={adding || !newTitle.trim()}
				class="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
			>
				{adding ? 'Adding…' : 'Add Task'}
			</button>
		</div>
	</div>
</Modal>
